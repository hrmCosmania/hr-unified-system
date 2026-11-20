-- ============================================================
-- ลิงก์ให้หัวหน้างานประเมินผลหลังฝึกอบรม (HRD)
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์นี้ → กด Run (รันซ้ำได้ ไม่เป็นไร)
-- ============================================================

create table if not exists training_followup_links (
  token text primary key,
  course_title text not null,
  employee_name text not null,
  employee_code text,
  supervisor_name text,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists training_followup_responses (
  id bigserial primary key,
  token text not null unique,
  rating int not null check (rating between 1 and 5),
  applied text,
  impact text,
  next_action text,
  supervisor text,
  imported boolean not null default false,
  responded_at timestamptz not null default now()
);

alter table training_followup_links enable row level security;
alter table training_followup_responses enable row level security;

drop policy if exists "authenticated manage followup links" on training_followup_links;
create policy "authenticated manage followup links" on training_followup_links
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated manage followup responses" on training_followup_responses;
create policy "authenticated manage followup responses" on training_followup_responses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- หัวหน้างานเปิดลิงก์โดยไม่ต้อง login: ดูได้เฉพาะชื่อหลักสูตร/ชื่อพนักงานของลิงก์นั้น
create or replace function get_followup_link(p_token text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'course', course_title, 'employee', employee_name,
    'code', employee_code, 'supervisor', supervisor_name, 'used', used)
  from training_followup_links where token = p_token limit 1
$$;

-- ส่งผลประเมิน: ใช้ได้ครั้งเดียวต่อลิงก์
create or replace function submit_followup(
  p_token text, p_rating int, p_applied text, p_impact text, p_next text, p_supervisor text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare t training_followup_links%rowtype;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then return 'invalid'; end if;
  select * into t from training_followup_links where token = p_token for update;
  if not found then return 'invalid'; end if;
  if t.used then return 'used'; end if;
  update training_followup_links set used = true, used_at = now() where token = p_token;
  insert into training_followup_responses (token, rating, applied, impact, next_action, supervisor)
  values (p_token, p_rating, left(coalesce(p_applied,''),100), left(coalesce(p_impact,''),2000),
          left(coalesce(p_next,''),2000), left(coalesce(p_supervisor,''),200));
  return 'ok';
end;
$$;

revoke all on function get_followup_link(text) from public;
revoke all on function submit_followup(text,int,text,text,text,text) from public;
grant execute on function get_followup_link(text) to anon, authenticated;
grant execute on function submit_followup(text,int,text,text,text,text) to anon, authenticated;
