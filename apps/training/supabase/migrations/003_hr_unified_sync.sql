-- =====================================================================
--  PeopleGrow HRD ใน "ระบบ HR รวมศูนย์" (hr-unified-system)
--  ใช้ Supabase project เดียวกับระบบ HR และระบบเงินเดือน
--
--  ลำดับการรัน: 001_hrd_schema.sql → 002_hrm_integration.sql → ไฟล์นี้
--
--  ระบบ HR รวมศูนย์เก็บพนักงานในตาราง hr_db (แถว id='main', data->'employees')
--  ไม่ใช่ตาราง public.employee แบบ HRM ทั่วไป → ไฟล์นี้แทนที่ hrd_sync_from_hrm()
--  ให้ดึงจาก hr_db แทน (หน้า "เชื่อมต่อระบบ HRM" และการซิงก์อัตโนมัติตอนเปิดแอปเรียกฟังก์ชันนี้)
--
--  ข้อมูลที่ดึง:  บริษัท (CMN/CIL) → hrd_business_units
--               แผนก → hrd_departments (code = บริษัท-แผนก)
--               ตำแหน่ง (jobCode) → hrd_positions (ระดับ O/S/M/D → job_level)
--               พนักงาน → hrd_employees (Inactive = resigned, คนที่หายจาก HR = resigned)
--               หัวหน้างาน (parentId) → manager_id
--               บัญชีล็อกอิน (auth.users) ที่อีเมลตรงกับพนักงาน → auth_user_id (ใช้ self-service)
-- =====================================================================

create or replace function hrd_level_rank(lv text) returns smallint
language sql immutable as $$
  select case upper(split_part(trim(coalesce(lv, '')), ',', 1))
    when 'O1' then 1 when 'O2' then 1 when 'O3' then 2
    when 'S1' then 3 when 'S2' then 3
    when 'M1' then 4 when 'M2' then 5
    when 'D1' then 6 when 'D2' then 7 when 'D3' then 7
    else 1 end::smallint
$$;

create or replace function hrd_sync_from_hrm()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payload jsonb; v_result jsonb; v_resigned int := 0; v_linked int := 0;
begin
  if not hrd_is_hr() and auth.role() <> 'service_role' then
    raise exception 'permission denied';
  end if;

  if not exists (select 1 from hr_db where id = 'main') then
    insert into hrd_sync_logs (system_code, finished_at, status, message)
    values ('HR_CORE', now(), 'failed', 'ไม่พบฐานข้อมูลระบบ HR (hr_db id=main)');
    return jsonb_build_object('error', 'ไม่พบฐานข้อมูลระบบ HR');
  end if;

  create temp table if not exists _hr_emp on commit drop as
    select x as e from hr_db, jsonb_array_elements(coalesce(data->'employees', '[]'::jsonb)) x where id = 'main';
  delete from _hr_emp where coalesce(trim(e->>'empCode'), '') = '';

  -- 1) บริษัท
  insert into hrd_business_units (code, name)
  select distinct upper(trim(e->>'company')), 'บริษัท ' || upper(trim(e->>'company'))
  from _hr_emp where coalesce(trim(e->>'company'), '') <> ''
  on conflict (code) do nothing;

  -- 2) แผนก (ชื่อแผนกซ้ำกันได้ระหว่างบริษัท → code = บริษัท-แผนก)
  insert into hrd_departments (code, name, business_unit_id)
  select distinct on (code) code, name, bu
  from (
    select upper(trim(e->>'company')) || '-' || trim(e->>'department') as code, trim(e->>'department') as name,
           (select id from hrd_business_units b where b.code = upper(trim(e->>'company'))) as bu
    from _hr_emp where coalesce(trim(e->>'department'), '') <> ''
  ) d
  on conflict (code) do update set name = excluded.name, business_unit_id = excluded.business_unit_id;

  -- 3) ตำแหน่ง (รหัสตำแหน่ง jobCode; ไม่มีรหัส → บริษัท-ชื่อตำแหน่ง)
  insert into hrd_positions (code, name, job_level, career_track)
  select distinct on (code) code, name, lvl, case when lvl >= 4 then 'management' else 'operation' end
  from (
    select coalesce(nullif(trim(e->>'jobCode'), ''), upper(trim(e->>'company')) || '-' || trim(e->>'position')) as code,
           coalesce(nullif(trim(e->>'position'), ''), trim(e->>'jobCode')) as name,
           hrd_level_rank(e->>'level') as lvl
    from _hr_emp where coalesce(nullif(trim(e->>'jobCode'), ''), nullif(trim(e->>'position'), '')) is not null
  ) p
  order by code, lvl desc
  on conflict (code) do update set name = excluded.name, job_level = excluded.job_level;

  -- 4) พนักงาน
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_code',   trim(e->>'empCode'),
    'first_name',      coalesce(nullif(split_part(trim(e->>'fullName'), ' ', 1), ''), trim(e->>'empCode')),
    'last_name',       coalesce(nullif(trim(substr(trim(e->>'fullName'), length(split_part(trim(e->>'fullName'), ' ', 1)) + 1)), ''), '-'),
    'nickname',        nullif(trim(e->>'nickname'), ''),
    'email',           nullif(lower(trim(e->>'email')), ''),
    'department_code', case when coalesce(trim(e->>'department'), '') <> '' then upper(trim(e->>'company')) || '-' || trim(e->>'department') end,
    'position_code',   coalesce(nullif(trim(e->>'jobCode'), ''), case when coalesce(trim(e->>'position'), '') <> '' then upper(trim(e->>'company')) || '-' || trim(e->>'position') end),
    'hire_date',       case when e->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$' then e->>'startDate' end,
    'status',          case when e->>'status' = 'Inactive' then 'resigned' else 'active' end
  )), '[]'::jsonb) into v_payload from _hr_emp;

  v_result := hrd_upsert_employees(v_payload);

  -- 5) พนักงานที่เคยซิงก์มา แต่ไม่มีในระบบ HR แล้ว → resigned (ไม่ลบ เพื่อเก็บประวัติอบรม)
  update hrd_employees h set status = 'resigned', synced_at = now()
  where h.synced_at is not null and h.status <> 'resigned'
    and not exists (select 1 from _hr_emp where trim(e->>'empCode') = h.employee_code);
  get diagnostics v_resigned = row_count;

  -- 6) หัวหน้างาน
  update hrd_employees h set manager_id = m.id
  from _hr_emp x join hrd_employees m on m.employee_code = trim(x.e->>'parentId')
  where h.employee_code = trim(x.e->>'empCode') and m.id <> h.id and h.manager_id is distinct from m.id;
  update hrd_employees h set manager_id = null
  from _hr_emp x
  where h.employee_code = trim(x.e->>'empCode') and coalesce(trim(x.e->>'parentId'), '') = '' and h.manager_id is not null;

  -- 7) ผูกบัญชีล็อกอินกับพนักงานด้วยอีเมล (เฉพาะที่ยังไม่ผูก และอีเมลไม่ซ้ำ)
  update hrd_employees h set auth_user_id = u.id
  from auth.users u
  where h.auth_user_id is null and h.email is not null and lower(u.email) = h.email
    and not exists (select 1 from hrd_employees o where o.auth_user_id = u.id)
    and (select count(*) from hrd_employees d where d.email = h.email) = 1;
  get diagnostics v_linked = row_count;

  return v_result || jsonb_build_object('resigned', v_resigned, 'linked', v_linked);
end $$;

grant execute on function hrd_sync_from_hrm() to authenticated, service_role;

-- การเชื่อมต่อที่แสดงในหน้า "เชื่อมต่อระบบ HRM"
insert into hrd_integrations (system_code, name, direction, description, status) values
  ('HR_CORE', 'ระบบ HR รวมศูนย์ (ฐานข้อมูลพนักงาน)', 'inbound', 'พนักงาน แผนก ตำแหน่ง หัวหน้างาน จาก hr_db — ซิงก์อัตโนมัติเมื่อผู้ดูแล/HR เปิดแอป', 'connected')
on conflict (system_code) do nothing;

-- สิทธิ์เริ่มต้น: ผู้ดูแลระบบเงินเดือน (plfl_profile.role = admin) = ผู้ดูแลระบบฝึกอบรม
-- เพิ่ม/เปลี่ยนสิทธิ์คนอื่นได้ที่หน้า ตั้งค่าระบบ ของแอปฝึกอบรม
insert into hrd_user_roles (auth_user_id, role)
select p.user_id, 'admin' from plfl_profile p where p.role = 'admin'
on conflict (auth_user_id) do nothing;

-- ความปลอดภัย: ฟังก์ชัน security definer เรียกได้เฉพาะผู้ที่ล็อกอินแล้ว (ไม่ให้ anon เรียกผ่าน /rest/v1/rpc)
alter function hrd_level_rank(text) set search_path = public;
revoke execute on function hrd_can_see_employee(uuid), hrd_current_role(), hrd_is_hr(), hrd_my_employee_id(),
  hrd_sync_from_hrm(), hrd_upsert_employees(jsonb) from public, anon;
grant execute on function hrd_can_see_employee(uuid), hrd_current_role(), hrd_is_hr(), hrd_my_employee_id(),
  hrd_sync_from_hrm(), hrd_upsert_employees(jsonb) to authenticated, service_role;
