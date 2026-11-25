-- =====================================================================
-- GrowTogether PM · 0800 · เชื่อมกับ "ระบบ HR รวมศูนย์" (hr-unified-system)
--
-- 1) public.hr_db_employee_rows()  อ่านรายชื่อพนักงานจากฐานข้อมูลระบบ HR (hr_db id='main')
--    เป็นแถวมาตรฐาน — ใช้ร่วมกันทั้งแอปฝึกอบรม (hrd_*) และ GrowTogether (pm.*)
-- 2) pm.apply_hr_db()  ซิงก์ บริษัท/แผนก → pm.org_units, ตำแหน่ง → pm.positions,
--    พนักงาน → pm.employees (หัวหน้างาน, บัญชีล็อกอินตามอีเมล, คนที่ไม่อยู่ใน HR แล้ว = terminated)
--    pm.sync_from_hrm()  = ปุ่ม/การเรียกจากแอป (เฉพาะ HR)
-- 3) บัญชี HR ของระบบหลัก (ผู้ดูแล/HR ในแอปฝึกอบรมหรือระบบเงินเดือน) = hr_admin ของ GrowTogether
--    แม้ยังไม่ได้ผูกกับรหัสพนักงาน
-- ลำดับ: รันหลัง 0100–0600 · ซิงก์อัตโนมัติเมื่อระบบ HR บันทึก: apps/training/supabase/migrations/004_auto_sync.sql
-- =====================================================================

-- ---------- 1) แถวพนักงานจากระบบ HR ----------
create or replace function public.hr_db_employee_rows()
returns table (emp_code text, first_name text, last_name text, nickname text, email text, company text,
               department text, job_code text, position_name text, level_code text, parent_code text,
               start_date date, end_date date, active boolean)
language sql stable security definer set search_path = public as $$
  select trim(x->>'empCode'),
         coalesce(nullif(split_part(trim(x->>'fullName'), ' ', 1), ''), trim(x->>'empCode')),
         coalesce(nullif(trim(substr(trim(x->>'fullName'), length(split_part(trim(x->>'fullName'), ' ', 1)) + 1)), ''), '-'),
         nullif(trim(x->>'nickname'), ''),
         nullif(lower(trim(x->>'email')), ''),
         nullif(upper(trim(x->>'company')), ''),
         nullif(trim(x->>'department'), ''),
         nullif(trim(x->>'jobCode'), ''),
         nullif(trim(x->>'position'), ''),
         upper(split_part(trim(coalesce(x->>'level', '')), ',', 1)),
         nullif(trim(x->>'parentId'), ''),
         case when x->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$' then (x->>'startDate')::date end,
         case when x->>'endDate' ~ '^\d{4}-\d{2}-\d{2}$' then (x->>'endDate')::date end,
         coalesce(x->>'status', 'Active') <> 'Inactive'
  from hr_db, jsonb_array_elements(coalesce(data->'employees', '[]'::jsonb)) x
  where id = 'main' and coalesce(trim(x->>'empCode'), '') <> ''
$$;
-- มีข้อมูลส่วนบุคคล: ใช้ภายในฐานข้อมูลเท่านั้น ไม่เปิดให้เรียกผ่าน API
revoke execute on function public.hr_db_employee_rows() from public, anon, authenticated;

-- ---------- 3) บัญชี HR ของระบบหลัก = hr_admin ----------
create or replace function pm.hr_account() returns boolean
language sql stable security definer set search_path = pm, public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.hrd_user_roles where auth_user_id = auth.uid() and role in ('admin', 'hr'))
    or exists (select 1 from public.plfl_profile where user_id = auth.uid() and role in ('admin', 'hr')))
$$;

create or replace function pm.has_role(r pm.app_role) returns boolean
language sql stable security definer set search_path = pm as $$
  select exists (
    select 1 from pm.user_roles ur
    where ur.employee_id = pm.current_employee_id() and ur.role = r
  ) or (r = 'hr_admin' and pm.hr_account())
$$;

create or replace function pm.is_hrbp_of(target uuid) returns boolean
language sql stable security definer set search_path = pm as $$
  select pm.hr_account() or exists (
    select 1
    from pm.employees e
    join pm.org_units o on o.id = e.org_unit_id
    join pm.user_roles ur on ur.employee_id = pm.current_employee_id()
    where e.id = target
      and (ur.role = 'hr_admin'
           or (ur.role = 'hrbp' and (ur.scope_business_unit is null or ur.scope_business_unit = o.business_unit)))
  )
$$;

-- ---------- 2) ซิงก์ระบบ HR → pm ----------
create or replace function pm.level_rank(lv text) returns smallint
language sql immutable set search_path = pm as $$
  select case lv when 'O1' then 1 when 'O2' then 2 when 'O3' then 3 when 'S1' then 4 when 'S2' then 4
                 when 'M1' then 5 when 'M2' then 6 when 'D1' then 7 when 'D2' then 8 when 'D3' then 8 else 1 end::smallint
$$;

create or replace function pm.apply_hr_db() returns jsonb
language plpgsql security definer set search_path = pm, public as $$
declare v_ins int := 0; v_upd int := 0; v_term int := 0; v_linked int := 0;
begin
  if not exists (select 1 from public.hr_db where id = 'main') then
    return jsonb_build_object('error', 'ไม่พบฐานข้อมูลระบบ HR');
  end if;

  -- บริษัท
  insert into pm.org_units (code, name_th, type, business_unit, synced_at)
  select distinct r.company, 'บริษัท ' || r.company, 'company'::pm.org_unit_type, 'hq'::pm.business_unit, now()
  from public.hr_db_employee_rows() r where r.company is not null
  on conflict (code) do update set name_th = excluded.name_th, is_active = true, synced_at = now();

  -- แผนก (ชื่อซ้ำกันได้ระหว่างบริษัท → code = บริษัท-แผนก)
  insert into pm.org_units (code, name_th, type, business_unit, parent_id, synced_at)
  select distinct on (d.code) d.code, d.department, 'department'::pm.org_unit_type, 'hq'::pm.business_unit,
         (select id from pm.org_units c where c.code = d.company), now()
  from (select coalesce(r.company, '') || '-' || r.department as code, r.department, r.company
        from public.hr_db_employee_rows() r where r.department is not null) d
  on conflict (code) do update set name_th = excluded.name_th, parent_id = excluded.parent_id, is_active = true, synced_at = now();

  -- ตำแหน่ง
  insert into pm.positions (code, title_th, job_level, is_people_manager)
  select distinct on (p.code) p.code, p.title, p.lvl, p.lvl >= 5
  from (select coalesce(r.job_code, coalesce(r.company, '') || '-' || r.position_name) as code,
               coalesce(r.position_name, r.job_code) as title, pm.level_rank(r.level_code) as lvl
        from public.hr_db_employee_rows() r where coalesce(r.job_code, r.position_name) is not null) p
  order by p.code, p.lvl desc
  on conflict (code) do update set title_th = excluded.title_th, job_level = excluded.job_level,
    is_people_manager = excluded.is_people_manager;

  -- พนักงาน
  with up as (
    insert into pm.employees (employee_code, first_name_th, last_name_th, nickname, email, org_unit_id, position_id,
                              employee_group, status, hire_date, termination_date, source, synced_at)
    select distinct on (r.emp_code) r.emp_code, r.first_name, r.last_name, r.nickname, r.email,
           (select id from pm.org_units o where o.code = coalesce(r.company, '') || '-' || r.department),
           (select id from pm.positions p where p.code = coalesce(r.job_code, coalesce(r.company, '') || '-' || r.position_name)),
           'office', case when r.active then 'active' else 'terminated' end::pm.employee_status,
           r.start_date, case when r.active then null else r.end_date end, 'hr_unified', now()
    from public.hr_db_employee_rows() r
    order by r.emp_code, r.active desc   -- รหัสซ้ำใน HR: ใช้แถวที่ยังทำงานอยู่
    on conflict (employee_code) do update set
      first_name_th = excluded.first_name_th, last_name_th = excluded.last_name_th, nickname = excluded.nickname,
      email = excluded.email, org_unit_id = coalesce(excluded.org_unit_id, employees.org_unit_id),
      position_id = coalesce(excluded.position_id, employees.position_id), status = excluded.status,
      hire_date = excluded.hire_date, termination_date = excluded.termination_date, source = 'hr_unified', synced_at = now()
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;

  -- ไม่มีในระบบ HR แล้ว → terminated (ไม่ลบ เพื่อเก็บประวัติผลงาน)
  update pm.employees e set status = 'terminated', termination_date = coalesce(e.termination_date, current_date), synced_at = now()
  where e.source = 'hr_unified' and e.status <> 'terminated'
    and not exists (select 1 from public.hr_db_employee_rows() r where r.emp_code = e.employee_code);
  get diagnostics v_term = row_count;

  -- หัวหน้างาน
  update pm.employees e set manager_id = m.id
  from public.hr_db_employee_rows() r join pm.employees m on m.employee_code = r.parent_code
  where e.employee_code = r.emp_code and m.id <> e.id and e.manager_id is distinct from m.id;
  update pm.employees e set manager_id = null
  from public.hr_db_employee_rows() r
  where e.employee_code = r.emp_code and r.parent_code is null and e.manager_id is not null;

  -- ผูกบัญชีล็อกอินด้วยอีเมล (เฉพาะที่ยังไม่ผูก และอีเมลไม่ซ้ำ)
  update pm.employees e set user_id = u.id
  from auth.users u
  where e.user_id is null and e.email is not null and lower(u.email) = e.email
    and not exists (select 1 from pm.employees o where o.user_id = u.id)
    and (select count(*) from pm.employees d where d.email = e.email) = 1;
  get diagnostics v_linked = row_count;

  return jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'terminated', v_term, 'linked', v_linked);
end $$;
revoke execute on function pm.apply_hr_db() from public, anon, authenticated;

create or replace function pm.sync_from_hrm() returns jsonb
language plpgsql security definer set search_path = pm, public as $$
begin
  if not pm.has_role('hr_admin') and auth.role() <> 'service_role' then raise exception 'permission denied'; end if;
  return pm.apply_hr_db();
end $$;
revoke execute on function pm.sync_from_hrm() from public, anon;
grant execute on function pm.sync_from_hrm() to authenticated, service_role;
