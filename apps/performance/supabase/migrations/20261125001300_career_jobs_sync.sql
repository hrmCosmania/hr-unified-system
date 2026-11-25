-- =====================================================================
-- เส้นทางอาชีพ (JD) + ตำแหน่งว่างภายใน (ใบขออัตรากำลัง) จากแอปหลัก → GrowTogether — 2026-11-25
--   hr_db.jd[]                      → pm.positions.career_next / career_criteria / career_timeline (ตาม Job Code)
--   hr_db.recruitmentRequisitions[] → pm.internal_jobs (external_id = id ใบขอ, เปิดรับ = status ไม่ใช่ closed/cancelled/filled)
-- เรียกจาก pm.apply_hr_framework() ซึ่งทำงานเมื่อแก้ JD/KPI/Competency/ใบขออัตรากำลัง/พนักงาน ในแอปหลัก
-- =====================================================================
alter table pm.positions add column if not exists career_next text;
alter table pm.positions add column if not exists career_criteria text;
alter table pm.positions add column if not exists career_timeline text;

create or replace function pm.apply_hr_career_jobs() returns jsonb
language plpgsql security definer set search_path = pm, public as $$
declare d jsonb; n_pos int := 0; n_job int := 0;
begin
  select data into d from public.hr_db where id = 'main';
  if d is null then return '{}'::jsonb; end if;

  update pm.positions p set career_next = j.nxt, career_criteria = j.crit, career_timeline = j.tl
  from (
    select distinct on (jc.code) jc.code,
           nullif(nullif(trim(x->>'careerPathNext'), ''), '-') nxt, nullif(trim(x->>'careerPathCriteria'), '') crit, nullif(trim(x->>'careerPathTimeline'), '') tl
    from jsonb_array_elements(coalesce(d->'jd', '[]')) x
    cross join lateral unnest(pm.expand_job_codes(x->>'jobCode')) jc(code)
  ) j
  where upper(p.code) = j.code;
  get diagnostics n_pos = row_count;

  insert into pm.internal_jobs (external_id, position_id, org_unit_id, title_th, close_date, status, synced_at)
  select 'hr:' || (x->>'id'),
         (select id from pm.positions where upper(code) = upper(trim(x->>'jobCode')) limit 1),
         (select id from pm.org_units where code = coalesce(x->>'company', '') || '-' || coalesce(x->>'department', '') limit 1),
         coalesce(nullif(trim(x->>'position'), ''), x->>'jobCode', 'ตำแหน่งว่าง'),
         nullif(x->>'targetDate', '')::date,
         case when lower(coalesce(x->>'status', '')) in ('closed', 'cancelled', 'canceled', 'filled', 'hired', 'on_hold', 'hold') then 'closed' else 'open' end,
         now()
  from jsonb_array_elements(coalesce(d->'recruitmentRequisitions', '[]')) x
  where coalesce(x->>'id', '') <> ''
  on conflict (external_id) do update set position_id = excluded.position_id, org_unit_id = excluded.org_unit_id, title_th = excluded.title_th,
    close_date = excluded.close_date, status = excluded.status, synced_at = now();
  get diagnostics n_job = row_count;
  update pm.internal_jobs j set status = 'closed', synced_at = now()
  where j.external_id like 'hr:%' and not exists (
    select 1 from jsonb_array_elements(coalesce(d->'recruitmentRequisitions', '[]')) x where 'hr:' || (x->>'id') = j.external_id);

  return jsonb_build_object('positions', n_pos, 'internal_jobs', n_job);
end $$;
revoke execute on function pm.apply_hr_career_jobs() from public, anon, authenticated;

-- ให้ทริกเกอร์ซิงก์ทำงานเมื่อ JD / ใบขออัตรากำลัง เปลี่ยนด้วย
create or replace function public.hr_db_sync_subapps()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare emp_changed boolean; fw_changed boolean;
begin
  if new.id <> 'main' then return new; end if;
  emp_changed := tg_op = 'INSERT' or (new.data->'employees') is distinct from (old.data->'employees');
  fw_changed := tg_op = 'INSERT' or emp_changed
    or (new.data->'kpiDefinitions') is distinct from (old.data->'kpiDefinitions')
    or (new.data->'competencies') is distinct from (old.data->'competencies')
    or (new.data->'competencyDictionary') is distinct from (old.data->'competencyDictionary')
    or (new.data->'jd') is distinct from (old.data->'jd')
    or (new.data->'recruitmentRequisitions') is distinct from (old.data->'recruitmentRequisitions');
  if emp_changed then
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
  end if;
  if fw_changed then
    if to_regprocedure('pm.apply_hr_framework()') is not null then
      begin perform pm.apply_hr_framework();
      exception when others then raise warning 'hr_db → pm KPI/Competency sync failed: %', sqlerrm; end;
    end if;
    if to_regprocedure('pm.apply_hr_career_jobs()') is not null then
      begin perform pm.apply_hr_career_jobs();
      exception when others then raise warning 'hr_db → pm career/jobs sync failed: %', sqlerrm; end;
    end if;
  end if;
  return new;
end $function$;

select pm.apply_hr_career_jobs();
