-- Interim hardening ของตารางเดิม public.hr_db (แอป v4.7 ยังใช้อยู่)
-- เดิม: policy ให้ "authenticated ทุกคน" อ่าน/เขียน/ลบได้ทั้งก้อน + anon ถือสิทธิ์ทุกอย่างระดับตาราง
-- ใหม่: เฉพาะ HR admin คนเดียว จนกว่าจะย้ายไป schema ใหม่ (20261102000003)
revoke all on public.hr_db from anon;
revoke truncate, references, trigger on public.hr_db from authenticated;

drop policy if exists "authenticated read/write hr_db" on public.hr_db;

create policy hr_db_admin_only on public.hr_db
  for all
  to authenticated
  using ((select auth.uid()) = 'fcea8d7d-ed42-4c79-9710-1c30de7b2a31'::uuid)
  with check ((select auth.uid()) = 'fcea8d7d-ed42-4c79-9710-1c30de7b2a31'::uuid);

comment on policy hr_db_admin_only on public.hr_db is
  'Interim 2026-11-02 (ค.ศ.): จำกัดเฉพาะ HR admin คนเดียว จะถูกแทนที่ด้วย role-based RLS แยก CMN/CIL';
