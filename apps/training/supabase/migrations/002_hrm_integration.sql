-- =====================================================================
--  PeopleGrow HRD — การเชื่อมโยงกับระบบ HRM อื่น ๆ
--
--  กรณีที่ 1 : HRD ติดตั้งใน Supabase project เดียวกับระบบ HRM Core
--             (มีตาราง public.employee / org_unit / position / division /
--              performance_review)  → ใช้ฟังก์ชัน hrd_sync_from_hrm()
--  กรณีที่ 2 : HRM อยู่คนละฐานข้อมูล → ให้ระบบต้นทางเรียก
--             RPC  hrd_upsert_employees(payload jsonb)  ผ่าน REST API
--             (เช่น จาก Edge Function / n8n / ระบบ ETL)
-- =====================================================================

-- ---------------------------------------------------------------------
-- กรณีที่ 2 : รับข้อมูลพนักงานเป็น JSON (ใช้ได้กับทุกระบบ HRM)
--   payload = [{ "hrm_employee_id": 101, "employee_code": "E0001",
--                "first_name": "...", "last_name": "...", "email": "...",
--                "department_code": "RT-OPS", "position_code": "STM",
--                "hire_date": "2022-01-10", "status": "active" }, ...]
-- ---------------------------------------------------------------------
create or replace function hrd_upsert_employees(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_ins int := 0; v_upd int := 0; v_dep uuid; v_pos uuid; v_bu uuid; v_exists boolean;
begin
  if not hrd_is_hr() and auth.role() <> 'service_role' then
    raise exception 'permission denied';
  end if;

  for r in select * from jsonb_array_elements(payload) loop
    select id, business_unit_id into v_dep, v_bu from hrd_departments where code = r->>'department_code';
    select id into v_pos from hrd_positions where code = r->>'position_code';
    select exists(select 1 from hrd_employees where employee_code = r->>'employee_code') into v_exists;

    insert into hrd_employees (employee_code, first_name, last_name, nickname, email,
                               business_unit_id, department_id, position_id, hire_date,
                               status, hrm_employee_id, synced_at)
    values (r->>'employee_code', r->>'first_name', r->>'last_name', r->>'nickname', r->>'email',
            v_bu, v_dep, v_pos, nullif(r->>'hire_date','')::date,
            coalesce(r->>'status','active'), nullif(r->>'hrm_employee_id','')::int, now())
    on conflict (employee_code) do update set
      first_name = excluded.first_name, last_name = excluded.last_name,
      nickname = excluded.nickname, email = excluded.email,
      business_unit_id = coalesce(excluded.business_unit_id, hrd_employees.business_unit_id),
      department_id = coalesce(excluded.department_id, hrd_employees.department_id),
      position_id = coalesce(excluded.position_id, hrd_employees.position_id),
      hire_date = excluded.hire_date, status = excluded.status,
      hrm_employee_id = excluded.hrm_employee_id, synced_at = now();

    if v_exists then v_upd := v_upd + 1; else v_ins := v_ins + 1; end if;
  end loop;

  insert into hrd_sync_logs (system_code, finished_at, status, inserted, updated, message)
  values ('HR_CORE', now(), 'success', v_ins, v_upd, 'hrd_upsert_employees via API');
  update hrd_integrations set last_sync_at = now(), records = (select count(*) from hrd_employees)
   where system_code = 'HR_CORE';

  return jsonb_build_object('inserted', v_ins, 'updated', v_upd);
end $$;

-- ---------------------------------------------------------------------
-- กรณีที่ 1 : Sync ตรงจากตาราง HRM Core ในฐานข้อมูลเดียวกัน
--   (ใช้ dynamic SQL เพื่อให้ migration นี้รันได้แม้ไม่มีตาราง HRM)
-- ---------------------------------------------------------------------
create or replace function hrd_sync_from_hrm()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payload jsonb; v_result jsonb;
begin
  if not hrd_is_hr() and auth.role() <> 'service_role' then
    raise exception 'permission denied';
  end if;

  if to_regclass('public.employee') is null then
    insert into hrd_sync_logs (system_code, finished_at, status, message)
    values ('HR_CORE', now(), 'failed', 'ไม่พบตาราง public.employee ของระบบ HRM ในฐานข้อมูลนี้');
    return jsonb_build_object('error', 'HRM tables not found');
  end if;

  -- 1) หน่วยงาน (org_unit) → hrd_departments
  execute $q$
    insert into hrd_departments (code, name, hrm_org_unit_id)
    select o.code, o.name_th, o.id from public.org_unit o where o.active
    on conflict (code) do update set name = excluded.name, hrm_org_unit_id = excluded.hrm_org_unit_id
  $q$;

  -- 2) ตำแหน่ง (position) → hrd_positions
  execute $q$
    insert into hrd_positions (code, name, hrm_position_id)
    select p.code, p.name_th, p.id from public.position p where p.active
    on conflict (code) do update set name = excluded.name, hrm_position_id = excluded.hrm_position_id
  $q$;

  -- 3) พนักงาน (employee) → hrd_employees
  execute $q$
    select coalesce(jsonb_agg(jsonb_build_object(
      'hrm_employee_id', e.id,
      'employee_code',   e.employee_code,
      'first_name',      e.first_name_th,
      'last_name',       e.last_name_th,
      'nickname',        e.nickname,
      'department_code', o.code,
      'position_code',   p.code,
      'hire_date',       e.hire_date,
      'status',          case when e.termination_date is not null and e.termination_date <= current_date
                              then 'resigned' else 'active' end)), '[]'::jsonb)
    from public.employee e
    left join public.org_unit o on o.id = e.org_unit_id
    left join public.position p on p.id = e.position_id
  $q$ into v_payload;

  v_result := hrd_upsert_employees(v_payload);

  -- 4) หัวหน้างาน (supervisor_id) → manager_id
  execute $q$
    update hrd_employees h set manager_id = m.id
    from public.employee e
    join hrd_employees m on m.hrm_employee_id = e.supervisor_id
    where h.hrm_employee_id = e.id
  $q$;

  -- 5) ผลประเมิน (performance_review) → hrd_performance_results
  if to_regclass('public.performance_review') is not null then
    execute $q$
      insert into hrd_performance_results (employee_id, year, score, grade, source_ref)
      select h.id, r.year, r.overall,
             case when r.overall >= 4.5 then 'A' when r.overall >= 3.5 then 'B'
                  when r.overall >= 2.5 then 'C' else 'D' end,
             'performance_review#' || r.id
      from public.performance_review r
      join hrd_employees h on h.hrm_employee_id = r.employee_id
      where r.status in ('finalized','approved','done')
      on conflict (employee_id, year) do update set score = excluded.score, grade = excluded.grade
    $q$;
    update hrd_integrations set last_sync_at = now() where system_code = 'PERFORMANCE';
  end if;

  return v_result;
end $$;

grant execute on function hrd_upsert_employees(jsonb) to authenticated, service_role;
grant execute on function hrd_sync_from_hrm() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Outbound : ส่งชั่วโมงอบรม / ใบรับรอง กลับไปยังระบบ HRM (ให้ระบบอื่นอ่าน)
-- ---------------------------------------------------------------------
create or replace view hrd_v_export_training_history with (security_invoker = true) as
select e.hrm_employee_id, e.employee_code, c.code as course_code, c.title as course_title,
       s.start_date, s.end_date, en.attended_hours, en.post_score, en.status,
       cert.cert_no, cert.issued_at, cert.expires_at
from hrd_enrollments en
join hrd_employees e on e.id = en.employee_id
join hrd_training_sessions s on s.id = en.session_id
join hrd_courses c on c.id = s.course_id
left join hrd_certificates cert on cert.enrollment_id = en.id
where en.status in ('attended','completed','failed');
