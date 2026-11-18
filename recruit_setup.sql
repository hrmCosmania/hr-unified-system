-- ตั้งค่าครั้งเดียวสำหรับโมดูล Recruitment: เก็บเรซูเม่ + Click Pulse (แบบสำรวจความพึงพอใจผู้จัดการผู้ว่าจ้าง)
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run

-- 1) ที่เก็บไฟล์เรซูเม่ (ส่วนตัว เฉพาะผู้ล็อกอินเท่านั้น)
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "authenticated manage resumes" on storage.objects;
create policy "authenticated manage resumes" on storage.objects
  for all
  using (bucket_id = 'resumes' and auth.role() = 'authenticated')
  with check (bucket_id = 'resumes' and auth.role() = 'authenticated');

-- 2) Click Pulse
create table if not exists recruit_pulse_tokens (
  token text primary key,
  job_id text not null,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists recruit_pulse_responses (
  id bigserial primary key,
  job_id text not null,
  score int not null check (score between 1 and 5),
  token text,
  responded_at timestamptz not null default now()
);

alter table recruit_pulse_tokens enable row level security;
alter table recruit_pulse_responses enable row level security;

drop policy if exists "authenticated manage pulse tokens" on recruit_pulse_tokens;
create policy "authenticated manage pulse tokens" on recruit_pulse_tokens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated read pulse responses" on recruit_pulse_responses;
create policy "authenticated read pulse responses" on recruit_pulse_responses
  for select using (auth.role() = 'authenticated');

-- ผู้จัดการกดลิงก์จากอีเมลโดยไม่ต้อง login: ฟังก์ชันนี้ตรวจ token แบบใช้ครั้งเดียวแล้วบันทึกคะแนน
create or replace function submit_recruit_pulse(p_token text, p_score int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t recruit_pulse_tokens%rowtype;
begin
  if p_score < 1 or p_score > 5 then return 'invalid'; end if;
  select * into t from recruit_pulse_tokens where token = p_token for update;
  if not found then return 'invalid'; end if;
  if t.used then return 'used'; end if;
  update recruit_pulse_tokens set used = true, used_at = now() where token = p_token;
  insert into recruit_pulse_responses (job_id, score, token) values (t.job_id, p_score, p_token);
  return 'ok';
end;
$$;

revoke all on function submit_recruit_pulse(text, int) from public;
grant execute on function submit_recruit_pulse(text, int) to anon, authenticated;
