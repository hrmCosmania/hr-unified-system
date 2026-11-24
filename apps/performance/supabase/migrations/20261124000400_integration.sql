set search_path = pm, public, extensions;
-- =====================================================================
-- GrowTogether PM · 0400 · Integration hub (Inbound staging + Outbox)
-- schema "integration" ไม่ถูกเปิดผ่าน PostgREST — เข้าถึงได้เฉพาะ service_role (Edge Functions)
-- =====================================================================
create schema if not exists pm_integration;
revoke all on schema pm_integration from public, anon, authenticated;
-- Edge Functions ใช้ service_role ผ่าน PostgREST → ต้องเพิ่ม "integration" ใน Dashboard › API › Exposed schemas
-- ปลอดภัยเพราะ anon/authenticated ไม่มีสิทธิ์ใด ๆ บน schema นี้
grant usage on schema pm_integration to service_role;
alter default privileges in schema pm_integration grant all on tables    to service_role;
alter default privileges in schema pm_integration grant all on sequences to service_role;
alter default privileges in schema pm_integration grant execute on functions to service_role;

create table pm_integration.sources (
  code          text primary key,                  -- core_hr, recruitment, lms, tna, payroll, pos, mes, qms, internal_job
  name_th       text not null,
  direction     text not null check (direction in ('inbound','outbound','both')),
  secret_hash   text,                              -- sha256 ของ shared secret (HMAC) — ห้ามเก็บ plain text
  outbound_url  text,                              -- webhook ปลายทาง (สำหรับ outbound)
  is_active     boolean not null default true,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error    text
);

create table pm_integration.inbound_events (
  id           bigserial primary key,
  source       text not null references pm_integration.sources(code),
  event_id     text not null,                      -- idempotency key จากระบบต้นทาง
  event_type   text not null,
  payload      jsonb not null,
  status       text not null default 'received' check (status in ('received','processed','failed','ignored')),
  error        text,
  attempts     smallint not null default 0,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, event_id)
);
create index on pm_integration.inbound_events(status, received_at);

create table pm_integration.outbox (
  id            bigserial primary key,
  target        text not null references pm_integration.sources(code),
  event_type    text not null,
  aggregate_id  uuid,
  payload       jsonb not null,
  status        text not null default 'pending' check (status in ('pending','sent','failed','dead')),
  attempts      smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error    text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index on pm_integration.outbox(status, next_attempt_at);

-- ---------------------------------------------------------------------
-- Inbound processor: แปลง event → upsert ตารางใน public
-- ---------------------------------------------------------------------
create or replace function pm_integration.process_inbound(p_id bigint) returns text
language plpgsql security definer set search_path = pm, pm_integration as $$
declare
  ev  pm_integration.inbound_events;
  d   jsonb;
  row jsonb;
  v_emp uuid; v_org uuid; v_kpi record; v_course uuid;
begin
  select * into ev from pm_integration.inbound_events where id = p_id for update;
  if ev.status = 'processed' then return 'already_processed'; end if;
  d := ev.payload -> 'data';

  case ev.event_type
  -- ===== Core HR =====
  when 'org_unit.upserted' then
    insert into pm.org_units (code, name_th, name_en, type, business_unit, parent_id, external_id, synced_at)
    values (d->>'code', d->>'name_th', d->>'name_en', (d->>'type')::org_unit_type, (d->>'business_unit')::business_unit,
            (select id from pm.org_units where code = d->>'parent_code'), d->>'external_id', now())
    on conflict (code) do update set name_th = excluded.name_th, name_en = excluded.name_en, type = excluded.type,
            business_unit = excluded.business_unit, parent_id = excluded.parent_id, synced_at = now();

  when 'position.upserted' then
    insert into pm.positions (code, title_th, title_en, job_family_id, job_level, grade, is_people_manager, external_id)
    values (d->>'code', d->>'title_th', d->>'title_en',
            (select id from pm.job_families where code = d->>'job_family_code'),
            coalesce((d->>'job_level')::smallint, 1), d->>'grade', coalesce((d->>'is_people_manager')::boolean, false), d->>'external_id')
    on conflict (code) do update set title_th = excluded.title_th, job_family_id = excluded.job_family_id,
            job_level = excluded.job_level, grade = excluded.grade, is_people_manager = excluded.is_people_manager;

  when 'employee.upserted' then
    insert into pm.employees (employee_code, first_name_th, last_name_th, nickname, email, mobile,
            org_unit_id, position_id, employee_group, status, hire_date, position_start_date, external_id, synced_at)
    values (d->>'employee_code', d->>'first_name_th', d->>'last_name_th', d->>'nickname', d->>'email', d->>'mobile',
            (select id from pm.org_units where code = d->>'org_unit_code'),
            (select id from pm.positions where code = d->>'position_code'),
            coalesce((d->>'employee_group')::employee_group, 'office'),
            coalesce((d->>'status')::employee_status, 'active'),
            (d->>'hire_date')::date, (d->>'position_start_date')::date, d->>'external_id', now())
    on conflict (employee_code) do update set
            first_name_th = excluded.first_name_th, last_name_th = excluded.last_name_th, nickname = excluded.nickname,
            email = excluded.email, mobile = excluded.mobile, org_unit_id = excluded.org_unit_id,
            position_id = excluded.position_id, employee_group = excluded.employee_group, status = excluded.status,
            position_start_date = excluded.position_start_date, synced_at = now();
    -- ตั้งหัวหน้าแยก (หัวหน้าอาจ sync มาทีหลัง)
    update pm.employees set manager_id = (select id from pm.employees where employee_code = d->>'manager_code')
     where employee_code = d->>'employee_code' and d ? 'manager_code';

  when 'employee.terminated' then
    update pm.employees set status = 'terminated', termination_date = (d->>'last_working_date')::date
     where employee_code = d->>'employee_code';

  -- ===== Recruitment =====
  when 'candidate.hired' then
    select id into v_emp from pm.employees where employee_code = d->>'employee_code';
    if v_emp is null then raise exception 'employee % not synced yet', d->>'employee_code'; end if;
    insert into pm.competency_assessments (employee_id, competency_id, level, source)
    select v_emp, c.id, (a->>'score')::numeric, 'recruitment'
      from jsonb_array_elements(d->'assessment') a join pm.competencies c on c.code = a->>'competency_code';
    -- สร้างเป้าทดลองงาน 30/60/90 วัน (ตาม template ของตำแหน่ง) ทำใน Edge Function onboarding

  when 'internal_job.upserted' then
    insert into pm.internal_jobs (external_id, position_id, org_unit_id, title_th, close_date, status, synced_at)
    values (d->>'job_id', (select id from pm.positions where code = d->>'position_code'),
            (select id from pm.org_units where code = d->>'org_unit_code'), d->>'title_th',
            (d->>'close_date')::date, coalesce(d->>'status','open'), now())
    on conflict (external_id) do update set title_th = excluded.title_th, close_date = excluded.close_date,
            status = excluded.status, synced_at = now();

  -- ===== LMS =====
  when 'course.upserted' then
    insert into pm.lms_courses (course_code, title_th, provider, delivery, duration_hours, competency_ids, url, synced_at)
    values (d->>'course_code', d->>'title_th', d->>'provider', d->>'delivery', (d->>'hours')::numeric,
            coalesce((select array_agg(c.id) from pm.competencies c
                       where c.code in (select jsonb_array_elements_text(d->'competency_codes'))), '{}'),
            d->>'url', now())
    on conflict (course_code) do update set title_th = excluded.title_th, duration_hours = excluded.duration_hours,
            competency_ids = excluded.competency_ids, url = excluded.url, synced_at = now();

  when 'training.completed', 'training.updated' then
    select id into v_emp from pm.employees where employee_code = d->>'employee_code';
    select id into v_course from pm.lms_courses where course_code = d->>'course_code';
    insert into pm.training_records (employee_id, course_id, status, score, completed_at, source_event_id)
    values (v_emp, v_course, coalesce(d->>'status','completed'), (d->>'score')::numeric, (d->>'completed_at')::timestamptz, ev.event_id)
    on conflict (employee_id, course_id) do update set status = excluded.status, score = excluded.score,
            completed_at = excluded.completed_at, source_event_id = excluded.source_event_id;

  -- ===== Time & Attendance (batch: data = array) =====
  when 'attendance.monthly' then
    for row in select * from jsonb_array_elements(d) loop
      insert into pm.attendance_monthly (employee_id, period, work_days, late_count, late_minutes, absent_days, leave_days, ot_hours, source_event_id)
      select e.id, (row->>'period' || '-01')::date, (row->>'work_days')::smallint, (row->>'late')::smallint,
             (row->>'late_minutes')::int, (row->>'absent')::numeric, (row->>'leave')::numeric, (row->>'ot_hours')::numeric, ev.event_id
        from pm.employees e where e.employee_code = row->>'employee_code'
      on conflict (employee_id, period) do update set work_days = excluded.work_days, late_count = excluded.late_count,
              late_minutes = excluded.late_minutes, absent_days = excluded.absent_days, leave_days = excluded.leave_days,
              ot_hours = excluded.ot_hours, source_event_id = excluded.source_event_id;
    end loop;

  -- ===== POS / MES / QMS (batch: data = array) =====
  when 'kpi.actual' then
    for row in select * from jsonb_array_elements(d) loop
      select id, data_source into v_kpi from pm.kpi_library where code = row->>'kpi_code';
      if v_kpi.id is null then continue; end if;
      v_emp := null; v_org := null;
      if row->>'scope' = 'employee' then
        select id into v_emp from pm.employees where employee_code = row->>'external_ref';
      else
        select id into v_org from pm.org_units where code = row->>'external_ref';
      end if;
      if v_emp is null and v_org is null then continue; end if;
      insert into pm.kpi_actuals (kpi_id, employee_id, org_unit_id, period, value, source, source_event_id)
      values (v_kpi.id, v_emp, v_org, (row->>'period' || '-01')::date, (row->>'value')::numeric, v_kpi.data_source, ev.event_id)
      on conflict (kpi_id, coalesce(employee_id,'00000000-0000-0000-0000-000000000000'), coalesce(org_unit_id,'00000000-0000-0000-0000-000000000000'), period)
      do update set value = excluded.value, source_event_id = excluded.source_event_id, recorded_at = now();
    end loop;

  else
    update pm_integration.inbound_events set status = 'ignored', processed_at = now() where id = p_id;
    return 'ignored';
  end case;

  update pm_integration.inbound_events set status = 'processed', processed_at = now(), error = null, attempts = attempts + 1 where id = p_id;
  update pm_integration.sources set last_success_at = now() where code = ev.source;
  return 'processed';
exception when others then
  update pm_integration.inbound_events set status = 'failed', error = sqlerrm, attempts = attempts + 1 where id = p_id;
  update pm_integration.sources set last_error_at = now(), last_error = sqlerrm where code = ev.source;
  return 'failed: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Outbox producers (trigger บนตาราง public)
-- ---------------------------------------------------------------------
create or replace function pm_integration.enqueue(p_target text, p_type text, p_aggregate uuid, p_payload jsonb) returns void
language sql security definer set search_path = pm_integration as $$
  insert into pm_integration.outbox (target, event_type, aggregate_id, payload)
  select p_target, p_type, p_aggregate, p_payload
   where exists (select 1 from pm_integration.sources s where s.code = p_target and s.is_active)
$$;

-- ผลประเมินถูก release → ส่ง Payroll & Compensation
create or replace function pm_integration.on_plan_released() returns trigger
language plpgsql security definer set search_path = pm, pm_integration as $$
begin
  if new.status = 'released' and old.status is distinct from 'released' then
    perform pm_integration.enqueue('payroll', 'performance.finalized', new.id, jsonb_build_object(
      'employee_code', (select employee_code from pm.employees where id = new.employee_id),
      'cycle_code',    (select code from pm.review_cycles where id = new.cycle_id),
      'overall_score', new.overall_score,
      'final_rating',  new.final_rating,
      'calibrated_rating', coalesce(new.calibrated_rating, new.final_rating)));
  end if;
  return new;
end $$;
create trigger t_plan_released after update of status on pm.performance_plans
  for each row execute function pm_integration.on_plan_released();

-- IDP เพิ่มหลักสูตร LMS → ขอลงทะเบียนใน LMS
create or replace function pm_integration.on_idp_course() returns trigger
language plpgsql security definer set search_path = pm, pm_integration as $$
begin
  if new.lms_course_id is not null and (tg_op = 'INSERT' or old.lms_course_id is distinct from new.lms_course_id) then
    perform pm_integration.enqueue('lms', 'idp.enrollment_requested', new.id, jsonb_build_object(
      'employee_code', (select e.employee_code from pm.idps i join pm.employees e on e.id = i.employee_id where i.id = new.idp_id),
      'course_code',   (select course_code from pm.lms_courses where id = new.lms_course_id),
      'idp_action_id', new.id,
      'due_date',      new.due_date));
  end if;
  return new;
end $$;
create trigger t_idp_course after insert or update of lms_course_id on pm.idp_actions
  for each row execute function pm_integration.on_idp_course();

-- Calibration lock → ส่งข้อมูล talent ให้ Internal Job / Succession
create or replace function pm_integration.on_calibration_locked() returns trigger
language plpgsql security definer set search_path = pm, pm_integration as $$
begin
  if new.status = 'locked' and old.status <> 'locked' then
    perform pm_integration.enqueue('internal_job', 'talent.updated', ce.plan_id, jsonb_build_object(
              'employee_code', e.employee_code, 'nine_box', ce.nine_box,
              'calibrated_rating', ce.calibrated_rating))
       from pm.calibration_entries ce
       join pm.performance_plans pp on pp.id = ce.plan_id
       join pm.employees e on e.id = pp.employee_id
      where ce.session_id = new.id;
    update pm.performance_plans pp set calibrated_rating = ce.calibrated_rating,
           potential_rating = ce.potential_level, status = 'calibration'
      from pm.calibration_entries ce where ce.session_id = new.id and pp.id = ce.plan_id;
  end if;
  return new;
end $$;
create trigger t_calibration_locked after update of status on pm.calibration_sessions
  for each row execute function pm_integration.on_calibration_locked();

-- ---------------------------------------------------------------------
-- Monitoring view (ให้ HR Admin เห็นผ่าน RPC — ไม่เปิดตารางโดยตรง)
-- ---------------------------------------------------------------------
create or replace function pm.integration_status()
returns table (code text, name_th text, direction text, is_active boolean, last_success_at timestamptz,
               last_error_at timestamptz, last_error text, events_24h bigint, failed_24h bigint, outbox_pending bigint)
language sql stable security definer set search_path = pm, pm_integration as $$
  select s.code, s.name_th, s.direction, s.is_active, s.last_success_at, s.last_error_at, s.last_error,
         (select count(*) from pm_integration.inbound_events i where i.source = s.code and i.received_at > now() - interval '24 hours'),
         (select count(*) from pm_integration.inbound_events i where i.source = s.code and i.status = 'failed' and i.received_at > now() - interval '24 hours'),
         (select count(*) from pm_integration.outbox o where o.target = s.code and o.status in ('pending','failed'))
    from pm_integration.sources s
   where pm.has_role('hr_admin')
   order by s.code
$$;

-- ---------------------------------------------------------------------
-- Seed แหล่งข้อมูล
-- ---------------------------------------------------------------------
insert into pm_integration.sources (code, name_th, direction) values
  ('core_hr',      'Core HR (ข้อมูลพนักงาน/โครงสร้าง)',      'inbound'),
  ('recruitment',  'Recruitment (สรรหา)',                  'inbound'),
  ('lms',          'LMS (ระบบการเรียนรู้)',                  'both'),
  ('tna',          'Time & Attendance',                    'inbound'),
  ('payroll',      'Payroll & Compensation',               'outbound'),
  ('pos',          'POS (ค้าปลีก)',                         'inbound'),
  ('mes',          'MES (การผลิต)',                         'inbound'),
  ('qms',          'QMS (คุณภาพ)',                          'inbound'),
  ('internal_job', 'Internal Job / Succession',            'both');
