-- Payroll Full Loop ใช้สิทธิ์จาก HR Unified System (hru_profile) — สำหรับเปิดเป็นเมนูหนึ่งใน HR Unified
-- ลำดับการหาบทบาท:
--   1) plfl_profile ที่กำหนดไว้ชัดเจน (ไม่ใช่ pending) — ผู้ดูแลกำหนดทับได้ เช่น ตั้ง disabled เพื่อปิดสิทธิ์
--   2) บทบาทหลังบ้านใน HR Unified (เฉพาะบัญชีที่ active):
--        owner → admin · hr_admin → hr · payroll → accountant
--      (recruiter / manager / supervisor / employee ไม่ได้สิทธิ์อัตโนมัติ — ผู้ดูแลกำหนดเองได้)
--   3) plfl_profile (pending)
-- ไม่แก้ตารางหรือฟังก์ชันของ HR Unified

create or replace function public.plfl_hru_role() returns text
language sql stable security definer set search_path = public as $$
  select case h.role when 'owner' then 'admin' when 'hr_admin' then 'hr' when 'payroll' then 'accountant' end
  from public.hru_profile h where h.user_id = auth.uid() and h.active
$$;

create or replace function public.plfl_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.plfl_profile where user_id = auth.uid() and role <> 'pending'),
    public.plfl_hru_role(),
    (select role from public.plfl_profile where user_id = auth.uid()))
$$;

-- คืนโปรไฟล์พร้อมบทบาทที่ใช้จริง (ชื่อจาก HR Unified ถ้ายังไม่ได้ตั้ง)
create or replace function public.plfl_me() returns public.plfl_profile
language plpgsql security definer set search_path = public as $$
declare p public.plfl_profile; hname text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select display_name into hname from public.hru_profile where user_id = auth.uid() and active;
  insert into public.plfl_profile (user_id, email, name)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), coalesce(nullif(hname, ''), split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)))
  on conflict (user_id) do update set email = excluded.email
  returning * into p;
  p.role := coalesce(public.plfl_role(), p.role);
  return p;
end $$;

-- รายชื่อผู้ใช้สำหรับหน้า "ผู้ใช้และสิทธิ์": บทบาทที่ตั้งไว้ + บทบาทที่ใช้จริง + ที่มา
create or replace function public.plfl_users()
returns table (user_id uuid, email text, name text, role text, effective text, source text, hru_role text, emp_id text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.email, p.name, p.role,
    coalesce(nullif(p.role, 'pending'), m.mapped, p.role),
    case when p.role <> 'pending' then 'plfl' when m.mapped is not null then 'hru' else 'none' end,
    h.role, p.emp_id, p.created_at
  from public.plfl_profile p
  left join public.hru_profile h on h.user_id = p.user_id and h.active
  left join lateral (select case h.role when 'owner' then 'admin' when 'hr_admin' then 'hr' when 'payroll' then 'accountant' end as mapped) m on true
  where public.plfl_role() in ('admin', 'hr')
  order by p.created_at
$$;

revoke all on function public.plfl_hru_role(), public.plfl_users() from public, anon;
grant execute on function public.plfl_hru_role(), public.plfl_users() to authenticated;
