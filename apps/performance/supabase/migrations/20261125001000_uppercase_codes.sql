-- =====================================================================
-- 1000 · รหัสพนักงานเป็นตัวพิมพ์ใหญ่เสมอในทุกแอปย่อย (ระบบเงินเดือนใช้ตัวพิมพ์ใหญ่อยู่แล้ว)
-- พบรหัสตัวพิมพ์เล็กในระบบ HR 1 คน → แอปย่อยจับคู่ไม่ตรง (เจ้าของระบบอนุมัติแก้ 25 พ.ย. 2026)
-- =====================================================================
update public.hrd_employees set employee_code = upper(employee_code) where employee_code <> upper(employee_code);
update pm.employees set employee_code = upper(employee_code) where employee_code <> upper(employee_code);

create or replace function public.hr_db_employee_rows()
returns table (emp_code text, first_name text, last_name text, nickname text, email text, company text,
               department text, job_code text, position_name text, level_code text, parent_code text,
               start_date date, end_date date, active boolean)
language sql stable security definer set search_path = public as $$
  select upper(trim(x->>'empCode')),
         coalesce(nullif(split_part(trim(x->>'fullName'), ' ', 1), ''), trim(x->>'empCode')),
         coalesce(nullif(trim(substr(trim(x->>'fullName'), length(split_part(trim(x->>'fullName'), ' ', 1)) + 1)), ''), '-'),
         nullif(trim(x->>'nickname'), ''),
         nullif(lower(trim(x->>'email')), ''),
         nullif(upper(trim(x->>'company')), ''),
         nullif(trim(x->>'department'), ''),
         nullif(trim(x->>'jobCode'), ''),
         nullif(trim(x->>'position'), ''),
         upper(split_part(trim(coalesce(x->>'level', '')), ',', 1)),
         nullif(upper(trim(x->>'parentId')), ''),
         case when x->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$' then (x->>'startDate')::date end,
         case when x->>'endDate' ~ '^\d{4}-\d{2}-\d{2}$' then (x->>'endDate')::date end,
         coalesce(x->>'status', 'Active') <> 'Inactive'
  from hr_db, jsonb_array_elements(coalesce(data->'employees', '[]'::jsonb)) x
  where id = 'main' and coalesce(trim(x->>'empCode'), '') <> ''
$$;
-- มีข้อมูลส่วนบุคคล: ใช้ภายในฐานข้อมูลเท่านั้น ไม่เปิดให้เรียกผ่าน API
revoke execute on function public.hr_db_employee_rows() from public, anon, authenticated;

-- แก้รหัสตัวพิมพ์เล็กในข้อมูลระบบ HR (พนักงาน, หัวหน้างาน, ผังองค์กร, ทดลองงาน) — ทำครั้งเดียว
-- update public.hr_db set data = replace(data::text, '"<รหัสเดิม>"', '"<รหัสใหม่>"')::jsonb where id = 'main';

-- ความปลอดภัย (25 พ.ย. 2026): ฟังก์ชันใน schema pm เรียกได้เฉพาะผู้ที่ล็อกอิน (ไม่ให้ anon/public)
revoke execute on all functions in schema pm from public, anon;
grant execute on all functions in schema pm to authenticated, service_role;
revoke execute on function pm.apply_hr_db() from authenticated;
alter default privileges in schema pm revoke execute on functions from public;
