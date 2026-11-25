-- =====================================================================
-- GrowTogether PM · 0900 · โหมด "HR บันทึกแทนพนักงาน" (เจ้าของระบบเลือก 25 พ.ย. 2026)
-- ตอนนี้มีแต่บัญชี HR ที่ล็อกอิน (ยังไม่ผูกกับรหัสพนักงาน) → ให้บัญชี HR (pm.hr_account())
-- บันทึก Check-in, อัปเดตค่าจริงของเป้าหมาย และแบบประเมิน (ตนเอง/หัวหน้า) แทนพนักงานได้
-- เป้าหมาย / แผนประเมิน มีสิทธิ์ผ่าน pm.is_hr() อยู่แล้ว (has_role('hr_admin') รวมบัญชี HR ใน 0800)
-- =====================================================================
drop policy if exists checkin_hr on pm.checkins;
create policy checkin_hr on pm.checkins for all to authenticated
  using (pm.hr_account()) with check (pm.hr_account());

drop policy if exists goal_upd_hr on pm.goal_updates;
create policy goal_upd_hr on pm.goal_updates for insert to authenticated
  with check (pm.hr_account());

drop policy if exists review_hr_insert on pm.reviews;
create policy review_hr_insert on pm.reviews for insert to authenticated
  with check (pm.hr_account());

drop policy if exists review_items_hr on pm.review_items;
create policy review_items_hr on pm.review_items for all to authenticated
  using (pm.hr_account()) with check (pm.hr_account());
