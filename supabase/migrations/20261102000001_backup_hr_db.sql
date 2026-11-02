-- 2026-11-02 (ค.ศ.) / 2569 (พ.ศ.)
-- สำรอง public.hr_db ก่อนเริ่ม hardening เก็บใน schema private (ไม่ expose ผ่าน PostgREST)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.hr_db_backup_20261102 as
  select id, data, updated_at, now() as backed_up_at from public.hr_db;
alter table private.hr_db_backup_20261102 enable row level security;
revoke all on private.hr_db_backup_20261102 from public, anon, authenticated;
