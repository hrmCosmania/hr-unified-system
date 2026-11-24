-- ตั้งผู้ดูแลระบบเงินเดือนคนแรก (ใช้ในฐานข้อมูลของระบบ HR รวมศูนย์ hr-unified-system)
-- ลำดับ: รัน 001_plfl_schema.sql ก่อน แล้วค่อยรันไฟล์นี้ (ไม่ต้องรัน 002_plfl_hru_roles.sql ในระบบนี้ — ไฟล์นั้นใช้กับอีกระบบที่มีตาราง hru_profile)
-- แก้อีเมลด้านล่างเป็นอีเมลที่ใช้ล็อกอินระบบ HR แล้วกด Run (ทำครั้งเดียว)
-- หลังจากนี้ ผู้ดูแลกำหนดสิทธิ์คนอื่นได้ในหน้า เงินเดือน > ตั้งค่าเวลา/พนักงาน/สิทธิ์ > ผู้ใช้และสิทธิ์
-- คนที่ล็อกอินระบบ HR ได้ แต่ยังไม่ได้รับบทบาทเงินเดือน จะไม่เห็นข้อมูลเงินเดือน (บทบาท pending)

insert into public.plfl_profile (user_id, email, name, role)
select u.id, u.email, split_part(u.email, '@', 1), 'admin'
from auth.users u
where lower(u.email) = lower('ใส่อีเมลที่ใช้ล็อกอินระบบ HR')
on conflict (user_id) do update set role = 'admin', updated_at = now();

-- ตรวจผล: ต้องเห็น 1 แถวที่ role = admin
select email, role from public.plfl_profile where role = 'admin';
