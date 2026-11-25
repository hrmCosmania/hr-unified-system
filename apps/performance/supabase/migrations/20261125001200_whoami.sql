-- =====================================================================
-- ผู้ใช้ที่ล็อกอินจริง (ระบบ HR รวมศูนย์) → GrowTogether — 2026-11-25
-- pm.whoami(): ชื่อ/อีเมลบัญชี, พนักงานที่ผูกกับบัญชี, บทบาทจริง (hr / manager / employee)
--   ผูกพนักงานด้วย pm.employees.user_id; ถ้ายังไม่ผูก ใช้อีเมลบัญชีตรงกับอีเมลพนักงาน แล้วผูกให้ (ครั้งแรก)
--   hr      = บัญชี HR ของระบบหลัก (pm.hr_account: ระบบเงินเดือน/แอปฝึกอบรม admin|hr) หรือมีบทบาท hr_admin/hrbp/executive
--   manager = มีลูกทีม (employees.manager_id = ตัวเอง) หรือบทบาท manager
--   employee = นอกนั้น
-- =====================================================================
create or replace function pm.whoami() returns jsonb
language plpgsql security definer set search_path = pm, public as $$
declare
  uid uuid := auth.uid();
  v_email text; v_name text; v_emp pm.employees%rowtype; v_role text;
begin
  if uid is null then return null; end if;
  select email, coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name') into v_email, v_name from auth.users where id = uid;
  v_name := coalesce((select nullif(trim(name), '') from public.plfl_profile where user_id = uid), v_name);

  select * into v_emp from pm.employees where user_id = uid limit 1;
  if v_emp.id is null and coalesce(v_email, '') <> '' then
    select * into v_emp from pm.employees where lower(email) = lower(v_email) and user_id is null and status <> 'terminated'
    order by created_at limit 1;
    if v_emp.id is not null then
      update pm.employees set user_id = uid where id = v_emp.id;
    end if;
  end if;

  v_role := case
    when pm.hr_account() or exists (select 1 from pm.user_roles where employee_id = v_emp.id and role in ('hr_admin', 'hrbp', 'executive')) then 'hr'
    when v_emp.id is not null and (exists (select 1 from pm.employees where manager_id = v_emp.id and status <> 'terminated')
         or exists (select 1 from pm.user_roles where employee_id = v_emp.id and role = 'manager')) then 'manager'
    else 'employee' end;

  return jsonb_build_object(
    'user_id', uid, 'email', v_email,
    'name', coalesce(nullif(trim(concat_ws(' ', v_emp.first_name_th, nullif(v_emp.last_name_th, '-'))), ''), v_name, split_part(coalesce(v_email, ''), '@', 1)),
    'employee_id', v_emp.id, 'employee_code', v_emp.employee_code,
    'role', v_role);
end $$;
revoke execute on function pm.whoami() from public, anon;
grant execute on function pm.whoami() to authenticated;
