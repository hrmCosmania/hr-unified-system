-- สิทธิ์ระบบเงินเดือน (plfl_profile.role) กำหนดสิทธิ์แอปฝึกอบรม (hrd_user_roles) อัตโนมัติ — applied 2026-11-25
-- ทำงานเมื่อเพิ่มผู้ใช้หรือเปลี่ยน role ในระบบเงินเดือนเท่านั้น (แก้ชื่อ/อีเมลไม่กระทบสิทธิ์ที่ตั้งไว้ในแอปฝึกอบรม)
-- admin→admin, hr→hr, manager→manager, employee/accountant→employee, pending/disabled→ลบสิทธิ์
create or replace function hrd_role_from_payroll() returns trigger
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  v := case new.role when 'admin' then 'admin' when 'hr' then 'hr' when 'manager' then 'manager'
                     when 'employee' then 'employee' when 'accountant' then 'employee' else null end;
  if v is null then
    delete from hrd_user_roles where auth_user_id = new.user_id;
  else
    insert into hrd_user_roles (auth_user_id, role) values (new.user_id, v)
    on conflict (auth_user_id) do update set role = excluded.role;
  end if;
  return new;
end $$;
revoke execute on function hrd_role_from_payroll() from public, anon, authenticated;

drop trigger if exists hrd_role_from_payroll on plfl_profile;
create trigger hrd_role_from_payroll after insert or update of role on plfl_profile
for each row execute function hrd_role_from_payroll();

insert into hrd_user_roles (auth_user_id, role)
select user_id, case role when 'accountant' then 'employee' else role end from plfl_profile
where role in ('admin','hr','manager','employee','accountant')
on conflict (auth_user_id) do update set role = excluded.role;
