-- =====================================================================
-- PeopleConnect ER — เชื่อมโยง HRM อื่นๆ + RPC สำหรับหน้าเว็บ
--   HR Core (public.hr_db)  → er_employees / er_departments  (trigger อัตโนมัติ)
--   L&D (hrd_*)             → er_lnd_summary()
--   Performance (pm.*)      → er_perf_summary()
--   Payroll / Time (โปรเจกต์ Supabase อื่น) → ผ่าน Edge Function (ดู docs/INTEGRATION.md)
-- =====================================================================

create or replace function er_level_rank(lv text) returns smallint
language sql immutable set search_path = public as $$
  select case upper(split_part(trim(coalesce(lv, '')), ',', 1))
    when 'O1' then 1 when 'O2' then 1 when 'O3' then 2 when 'S1' then 3 when 'S2' then 3
    when 'M1' then 4 when 'M2' then 5 when 'D1' then 6 when 'D2' then 7 when 'D3' then 7
    else 1 end::smallint
$$;

-- ---------- สร้าง milestone ตลอดเส้นทางพนักงานอัตโนมัติ ----------
create or replace function er_generate_milestones() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- milestone ที่เลยมาเกิน 30 วันแล้วตอนสร้าง (พนักงานเก่า) = skipped ไม่ขึ้นเป็นงานค้าง (ปรับในระบบ HR รวมศูนย์)
  insert into er_journey_milestones (employee_id, stage, milestone, title, due_date, owner_role, status)
  select e.id, m.stage, m.milestone, m.title, e.hire_date + m.offset_days, m.owner_role,
         case when e.hire_date + m.offset_days < current_date - 30 then 'skipped' else 'pending' end
  from er_employees e
  cross join (values
    ('onboard','welcome_kit','ส่ง Welcome Kit & แนะนำ Buddy',         -3,  'hr'),
    ('onboard','day1','Day 1: ปฐมนิเทศ & วัฒนธรรมองค์กร',               0,  'hr'),
    ('onboard','day30','พูดคุย 30 วันกับหัวหน้า (Check-in)',              30, 'manager'),
    ('onboard','day60','Onboarding Pulse Survey',                        60, 'employee'),
    ('onboard','probation','ประเมินผ่านทดลองงาน (119 วัน)',              110, 'manager'),
    ('develop','idp','จัดทำแผนพัฒนารายบุคคล (IDP)',                     150, 'manager'),
    ('engage','anniversary_1y','ฉลองครบ 1 ปี',                          365, 'hr'),
    ('retain','stay_interview','Stay Interview',                         540, 'manager'),
    ('engage','anniversary_3y','ฉลองครบ 3 ปี',                          1095, 'hr'),
    ('engage','anniversary_5y','ฉลองครบ 5 ปี · Service Award',         1826, 'hr')
  ) as m(stage, milestone, title, offset_days, owner_role)
  where e.hire_date is not null and e.status <> 'resigned'
  on conflict (employee_id, milestone) do nothing;
  get diagnostics n = row_count;

  -- พนักงานลาออก → สร้าง Offboarding milestones
  insert into er_journey_milestones (employee_id, stage, milestone, title, due_date, owner_role)
  select e.id, 'offboard', m.milestone, m.title, coalesce(e.end_date, current_date) + m.offset_days, m.owner_role
  from er_employees e
  cross join (values
    ('exit_interview','Exit Interview',                 -7, 'hr'),
    ('handover','ส่งมอบงานและทรัพย์สิน',               -3, 'manager'),
    ('farewell','Farewell with Care · ขอบคุณและอำลา',   0, 'hr'),
    ('alumni','เชิญเข้าร่วม Alumni Network',           30, 'hr')
  ) as m(milestone, title, offset_days, owner_role)
  where e.status = 'resigned'
  on conflict (employee_id, milestone) do nothing;

  -- รายการที่เลยกำหนด
  update er_journey_milestones set status = 'overdue'
  where status = 'pending' and due_date < current_date - 7;
  return n;
end $$;
revoke execute on function er_generate_milestones() from public, anon, authenticated;

-- ---------- ซิงก์จาก HR Core (hr_db) ----------
create or replace function er_apply_hr_db() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ins int := 0; v_upd int := 0; v_resigned int := 0; v_linked int := 0;
begin
  if to_regprocedure('public.hr_db_employee_rows()') is null
     or not exists (select 1 from hr_db where id = 'main') then
    return jsonb_build_object('error', 'ไม่พบฐานข้อมูลระบบ HR Core');
  end if;

  insert into er_departments (code, name, company)
  select distinct on (d.code) d.code, d.department, d.company
  from (select coalesce(r.company, '') || '-' || r.department as code, r.department, r.company
        from hr_db_employee_rows() r where r.department is not null) d
  on conflict (code) do update set name = excluded.name, company = excluded.company;

  with up as (
    insert into er_employees (employee_code, first_name, last_name, nickname, email, company, department_id,
                              position_name, job_level, hire_date, end_date, status, synced_at)
    select distinct on (r.emp_code) r.emp_code, r.first_name, r.last_name, r.nickname, r.email, r.company,
           (select id from er_departments d where d.code = coalesce(r.company, '') || '-' || r.department),
           r.position_name, er_level_rank(r.level_code), r.start_date,
           case when r.active then null else r.end_date end,
           case when not r.active then 'resigned'
                when r.start_date > current_date - 119 then 'probation'
                else 'active' end,
           now()
    from hr_db_employee_rows() r
    order by r.emp_code, r.active desc
    on conflict (employee_code) do update set
      first_name = excluded.first_name, last_name = excluded.last_name, nickname = excluded.nickname,
      email = excluded.email, company = excluded.company,
      department_id = coalesce(excluded.department_id, er_employees.department_id),
      position_name = excluded.position_name, job_level = excluded.job_level,
      hire_date = excluded.hire_date, end_date = excluded.end_date, status = excluded.status, synced_at = now()
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;

  update er_employees h set status = 'resigned', end_date = coalesce(h.end_date, current_date), synced_at = now()
  where h.synced_at is not null and h.status <> 'resigned'
    and not exists (select 1 from hr_db_employee_rows() r where r.emp_code = h.employee_code);
  get diagnostics v_resigned = row_count;

  update er_employees h set manager_id = m.id
  from hr_db_employee_rows() r join er_employees m on m.employee_code = r.parent_code
  where h.employee_code = r.emp_code and m.id <> h.id and h.manager_id is distinct from m.id;

  update er_employees h set auth_user_id = u.id
  from auth.users u
  where h.auth_user_id is null and h.email is not null and lower(u.email) = h.email
    and not exists (select 1 from er_employees o where o.auth_user_id = u.id)
    and (select count(*) from er_employees d where d.email = h.email) = 1;
  get diagnostics v_linked = row_count;

  perform er_generate_milestones();

  insert into er_sync_logs (system_code, finished_at, status, inserted, updated, message)
  values ('HR_CORE', now(), 'success', v_ins, v_upd, 'ซิงก์จากระบบ HR Core (hr_db)');
  update er_integrations set last_sync_at = now(), records = (select count(*) from er_employees), status = 'connected'
  where system_code = 'HR_CORE';

  return jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'resigned', v_resigned, 'linked', v_linked);
end $$;
revoke execute on function er_apply_hr_db() from public, anon, authenticated;

create or replace function er_sync_from_hrm() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not er_is_hr() and auth.role() <> 'service_role' then raise exception 'permission denied'; end if;
  return er_apply_hr_db();
end $$;
revoke execute on function er_sync_from_hrm() from public, anon;
grant execute on function er_sync_from_hrm() to authenticated, service_role;

-- เพิ่ม ER เข้าไปใน trigger กลางที่กระจายข้อมูลจาก hr_db ไปทุกโมดูล (คงพฤติกรรมเดิมของ hrd / pm)
do $$
begin
  if to_regclass('public.hr_db') is null then return; end if;
  execute $f$
  create or replace function public.hr_db_sync_subapps() returns trigger
  language plpgsql security definer set search_path = public as $body$
  begin
    if new.id <> 'main' then return new; end if;
    if tg_op = 'UPDATE' and (new.data->'employees') is not distinct from (old.data->'employees') then return new; end if;
    if to_regprocedure('public.hrd_apply_hr_db()') is not null then
      begin perform hrd_apply_hr_db();
      exception when others then raise warning 'hr_db → hrd sync failed: %', sqlerrm; end;
    end if;
    if to_regprocedure('pm.apply_hr_db()') is not null then
      begin perform pm.apply_hr_db();
      exception when others then raise warning 'hr_db → pm sync failed: %', sqlerrm; end;
    end if;
    if to_regprocedure('public.er_apply_hr_db()') is not null then
      begin perform er_apply_hr_db();
      exception when others then raise warning 'hr_db → er sync failed: %', sqlerrm; end;
    end if;
    return new;
  end $body$;
  $f$;
  execute 'revoke execute on function public.hr_db_sync_subapps() from public, anon, authenticated';
  execute 'drop trigger if exists hr_db_sync_subapps on public.hr_db';
  execute 'create trigger hr_db_sync_subapps after insert or update of data on public.hr_db
           for each row execute function public.hr_db_sync_subapps()';
end $$;

-- ---------- ส่งแบบสำรวจ (รักษาความเป็นนิรนาม) ----------
create or replace function er_submit_survey(p_survey uuid, p_answers jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_emp er_employees; v_s er_surveys; v_resp uuid; v_years numeric;
begin
  select * into v_emp from er_employees where id = er_current_employee_id();
  if v_emp.id is null then raise exception 'ไม่พบข้อมูลพนักงานของบัญชีนี้'; end if;
  select * into v_s from er_surveys where id = p_survey;
  if v_s.id is null or v_s.status <> 'open' then raise exception 'แบบสำรวจนี้ปิดรับคำตอบแล้ว'; end if;
  if exists (select 1 from er_survey_participation where survey_id = p_survey and employee_id = v_emp.id) then
    raise exception 'คุณตอบแบบสำรวจนี้แล้ว';
  end if;

  insert into er_survey_participation (survey_id, employee_id) values (p_survey, v_emp.id);
  v_years := extract(epoch from age(current_date, coalesce(v_emp.hire_date, current_date))) / 31557600;
  insert into er_survey_responses (survey_id, employee_id, department_id, tenure_band)
  values (p_survey, case when v_s.is_anonymous then null else v_emp.id end, v_emp.department_id,
          case when v_years < 1 then '<1y' when v_years < 3 then '1-3y' when v_years < 5 then '3-5y' else '5y+' end)
  returning id into v_resp;

  insert into er_survey_answers (response_id, question_id, score, answer_text)
  select v_resp, (a->>'question_id')::uuid, nullif(a->>'score','')::smallint, nullif(a->>'text','')
  from jsonb_array_elements(p_answers) a
  where exists (select 1 from er_survey_questions q where q.id = (a->>'question_id')::uuid and q.survey_id = p_survey);
  return true;
end $$;
revoke execute on function er_submit_survey(uuid, jsonb) from public, anon;
grant execute on function er_submit_survey(uuid, jsonb) to authenticated;

-- ---------- ผลแบบสำรวจแบบรวม (ซ่อนกลุ่มที่ผู้ตอบ < min_group_size) ----------
create or replace function er_survey_results(p_survey uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_s er_surveys; v_out jsonb;
begin
  if not er_is_hr() then raise exception 'permission denied'; end if;
  select * into v_s from er_surveys where id = p_survey;
  select jsonb_build_object(
    'responses', (select count(*) from er_survey_responses where survey_id = p_survey),
    'invited',   (select count(*) from er_employees where status <> 'resigned'),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'dimension', q.dimension, 'q_type', q.q_type,
               'avg', round(avg(a.score)::numeric, 2), 'n', count(a.score),
               'favorable', round(100.0 * count(*) filter (where (q.q_type = 'likert' and a.score >= 4) or (q.q_type = 'nps' and a.score >= 9)) / nullif(count(a.score), 0), 1),
               'enps', case when q.q_type = 'nps' then round(100.0 * (count(*) filter (where a.score >= 9) - count(*) filter (where a.score <= 6)) / nullif(count(a.score), 0)) end
             ) order by q.seq)
      from er_survey_questions q left join er_survey_answers a on a.question_id = q.id
      where q.survey_id = p_survey and q.q_type in ('likert','nps')
      group by q.id, q.text, q.dimension, q.q_type, q.seq), '[]'::jsonb),
    'by_department', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('department', d.name, 'n', count(distinct r.id),
                 'favorable', round(100.0 * count(*) filter (where a.score >= 4) / nullif(count(a.score), 0), 1)) x
        from er_survey_responses r
        join er_departments d on d.id = r.department_id
        join er_survey_answers a on a.response_id = r.id
        join er_survey_questions q on q.id = a.question_id and q.q_type = 'likert'
        where r.survey_id = p_survey
        group by d.name
        having count(distinct r.id) >= v_s.min_group_size) t), '[]'::jsonb),
    'comments', case when v_s.is_anonymous then coalesce((
        select jsonb_agg(a.answer_text order by random()) from er_survey_answers a
        join er_survey_responses r on r.id = a.response_id
        where r.survey_id = p_survey and a.answer_text is not null), '[]'::jsonb) else '[]'::jsonb end
  ) into v_out;
  return v_out;
end $$;
revoke execute on function er_survey_results(uuid) from public, anon;
grant execute on function er_survey_results(uuid) to authenticated;

-- ---------- ส่ง feedback (คืนรหัสติดตาม — ใช้ได้กับแบบไม่ระบุตัวตน) ----------
create or replace function er_submit_feedback(p_type text, p_category text, p_subject text, p_body text, p_anonymous boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if er_current_employee_id() is null then raise exception 'ไม่พบข้อมูลพนักงานของบัญชีนี้'; end if;
  insert into er_feedback (feedback_type, category, subject, body, is_anonymous, employee_id)
  values (p_type, coalesce(p_category, 'general'), p_subject, p_body, p_anonymous,
          case when p_anonymous then null else er_current_employee_id() end)
  returning ref_code into v_code;
  return v_code;
end $$;

create or replace function er_feedback_lookup(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('subject', subject, 'status', status, 'response', response, 'responded_at', responded_at, 'created_at', created_at)
  from er_feedback where ref_code = upper(trim(p_code))
$$;
revoke execute on function er_submit_feedback(text, text, text, text, boolean), er_feedback_lookup(text) from public, anon;
grant execute on function er_submit_feedback(text, text, text, text, boolean), er_feedback_lookup(text) to authenticated;

-- ---------- ภาพรวม Wellbeing (เฉพาะ HR, ต้องมีอย่างน้อย 5 คน/สัปดาห์) ----------
create or replace function er_wellbeing_trend(p_weeks int default 12) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not er_is_hr() then null else coalesce(jsonb_agg(t order by t->>'week'), '[]'::jsonb) end
  from (
    select jsonb_build_object('week', to_char(date_trunc('week', checkin_on), 'YYYY-MM-DD'),
             'mood', round(avg(mood)::numeric, 2), 'stress', round(avg(stress)::numeric, 2), 'n', count(*)) t
    from er_wellbeing_checkins
    where checkin_on >= current_date - (p_weeks * 7)
    group by date_trunc('week', checkin_on)
    having count(*) >= 5
  ) s
$$;
revoke execute on function er_wellbeing_trend(int) from public, anon;
grant execute on function er_wellbeing_trend(int) to authenticated;

-- ---------- ข้อมูลจากระบบ L&D (hrd_*) ผ่าน employee_code ----------
create or replace function er_lnd_summary(p_employee uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_code text; v_out jsonb;
begin
  if not (p_employee = er_current_employee_id() or er_is_manager_of(p_employee) or er_is_hr()) then
    raise exception 'permission denied';
  end if;
  if to_regclass('public.hrd_employees') is null then return jsonb_build_object('connected', false); end if;
  select employee_code into v_code from er_employees where id = p_employee;
  execute $q$
    select jsonb_build_object('connected', true,
      'courses',      (select count(*) from hrd_enrollments en where en.employee_id = he.id),
      'completed',    (select count(*) from hrd_enrollments en where en.employee_id = he.id and en.status in ('completed','passed','attended')),
      'hours',        (select coalesce(sum(attended_hours), 0) from hrd_enrollments en where en.employee_id = he.id),
      'certificates', (select count(*) from hrd_certificates c where c.employee_id = he.id),
      'idp_status',   (select status from hrd_idps i where i.employee_id = he.id order by year desc limit 1),
      'idp_goal',     (select goal from hrd_idps i where i.employee_id = he.id order by year desc limit 1),
      'upcoming',     (select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'start_date', s.start_date) order by s.start_date), '[]'::jsonb)
                       from hrd_enrollments en join hrd_training_sessions s on s.id = en.session_id join hrd_courses c on c.id = s.course_id
                       where en.employee_id = he.id and s.start_date >= current_date))
    from hrd_employees he where he.employee_code = $1
  $q$ into v_out using v_code;
  return coalesce(v_out, jsonb_build_object('connected', true, 'courses', 0, 'completed', 0, 'hours', 0, 'certificates', 0));
end $$;
revoke execute on function er_lnd_summary(uuid) from public, anon;
grant execute on function er_lnd_summary(uuid) to authenticated;

-- ---------- ข้อมูลจากระบบ Performance (pm.*) ----------
create or replace function er_perf_summary(p_employee uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_code text; v_out jsonb;
begin
  if not (p_employee = er_current_employee_id() or er_is_manager_of(p_employee) or er_is_hr()) then
    raise exception 'permission denied';
  end if;
  if to_regclass('pm.employees') is null then return jsonb_build_object('connected', false); end if;
  select employee_code into v_code from er_employees where id = p_employee;
  execute $q$
    select jsonb_build_object('connected', true,
      'goals',        (select count(*) from pm.goals g where g.employee_id = pe.id),
      'avg_progress', (select round(avg(progress_pct)) from pm.goals g where g.employee_id = pe.id),
      'feedback',     (select count(*) from pm.feedback f where f.to_employee_id = pe.id))
    from pm.employees pe where pe.employee_code = $1
  $q$ into v_out using v_code;
  return coalesce(v_out, jsonb_build_object('connected', true, 'goals', 0));
exception when undefined_column or undefined_table then
  return jsonb_build_object('connected', true, 'goals', null);
end $$;
revoke execute on function er_perf_summary(uuid) from public, anon;
grant execute on function er_perf_summary(uuid) to authenticated;
