-- =====================================================================
-- PeopleConnect: ที่เก็บข้อมูลเงินเดือน (แยกจาก hr_db และจำกัดสิทธิ์ด้วย RLS)
-- รันครั้งเดียวใน Supabase Dashboard -> SQL Editor
-- ก่อนรัน: แก้อีเมลในบรรทัด INSERT ด้านล่างให้เป็นอีเมลที่ HR ใช้ล็อกอินจริง
-- =====================================================================

-- 1) รายชื่อผู้มีสิทธิ์ดู/แก้ข้อมูลเงินเดือน
create table if not exists public.payroll_admins (
  email text primary key
);

-- 2) ฟังก์ชันตรวจสิทธิ์ (security definer เพื่อไม่ให้ policy วนซ้ำตัวเอง)
create or replace function public.is_payroll_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.payroll_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_payroll_admin() to authenticated;

-- 3) ตารางข้อมูลเงินเดือน (แถวเดียว id = 'main')
create table if not exists public.hr_payroll (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.payroll_admins enable row level security;
alter table public.hr_payroll enable row level security;

drop policy if exists payroll_admins_all on public.payroll_admins;
create policy payroll_admins_all on public.payroll_admins
  for all to authenticated
  using (public.is_payroll_admin())
  with check (public.is_payroll_admin());

drop policy if exists hr_payroll_all on public.hr_payroll;
create policy hr_payroll_all on public.hr_payroll
  for all to authenticated
  using (public.is_payroll_admin())
  with check (public.is_payroll_admin());

-- 4) เพิ่มผู้มีสิทธิ์คนแรก  (!! แก้อีเมลตรงนี้ก่อนรัน !!)
insert into public.payroll_admins (email)
values ('แก้เป็นอีเมลที่ใช้ล็อกอิน@example.com')
on conflict do nothing;
