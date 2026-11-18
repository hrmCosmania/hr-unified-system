-- ตั้งค่าครั้งเดียว: ฟีดปฏิทิน HR (วันเกิด / ครบรอบอายุงาน / ทดลองงาน) สำหรับ Subscribe ใน Google Calendar
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
create table if not exists hr_calendar_feed (
  token text primary key,
  ics text not null,
  updated_at timestamptz default now()
);

alter table hr_calendar_feed enable row level security;

drop policy if exists "authenticated manage calendar feed" on hr_calendar_feed;
create policy "authenticated manage calendar feed" on hr_calendar_feed
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ผู้ที่ไม่ล็อกอินอ่านได้เฉพาะเมื่อรู้ token ลับเท่านั้น (ผ่านฟังก์ชันนี้) ไม่สามารถ list ตารางได้
create or replace function get_calendar_feed(p_token text)
returns text
language sql
security definer
set search_path = public
as $$
  select ics from hr_calendar_feed where token = p_token limit 1
$$;

revoke all on function get_calendar_feed(text) from public;
grant execute on function get_calendar_feed(text) to anon, authenticated;
