-- Payroll Full Loop — ฐานข้อมูลบน Supabase
-- ทุกอย่างขึ้นต้นด้วย plfl_ เพื่อไม่ชนกับระบบอื่นในโปรเจกต์เดียวกัน
--
-- โครงสร้าง: ข้อมูลแอปแบ่งเป็น "เอกสาร" (plfl_doc) ตามกลุ่มสิทธิ์ เช่น employees, pay_profiles, period:2026-10
--   - สิทธิ์อ่าน/เขียนคุมด้วย RLS ตามบทบาทใน plfl_profile
--   - บันทึกผ่าน plfl_save() แบบตรวจเวอร์ชัน (มีคนแก้ก่อน → conflict)
--   - ทุกการเปลี่ยนแปลงถูกบันทึกระดับฟิลด์ใน plfl_audit ด้วย trigger ฝั่งเซิร์ฟเวอร์ (แก้จากหน้าเว็บไม่ได้)
--   - สำรองข้อมูลลง plfl_backup อัตโนมัติวันละครั้ง (เรียกจากแอปเมื่อผู้มีสิทธิ์เข้าใช้งาน) และสำรองเองได้

-- ---------- ผู้ใช้และบทบาท ----------
create table if not exists public.plfl_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'pending'
    check (role in ('pending', 'admin', 'hr', 'accountant', 'manager', 'employee', 'disabled')),
  emp_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plfl_profile enable row level security;

create or replace function public.plfl_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.plfl_profile where user_id = auth.uid()
$$;

-- กลุ่มเอกสาร: period:* / punches:* / pay (pay_profiles, pay_config, pay_run:*) / ชื่อเอกสาร
create or replace function public.plfl_doc_class(k text) returns text
language sql immutable set search_path = public as $$
  select case
    when k like 'period:%' then 'period'
    when k like 'punches:%' then 'punches'
    when k like 'pay\_run:%' or k in ('pay_profiles', 'pay_config') then 'pay'
    else k end
$$;

-- อ่าน: admin/hr/accountant ทุกเอกสาร · manager ทุกอย่างยกเว้นข้อมูลเงินเดือน
create or replace function public.plfl_can_read(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(r in ('admin', 'hr', 'accountant') or (r = 'manager' and public.plfl_doc_class(k) <> 'pay'), false)
  from (select public.plfl_role() as r) x
$$;

-- เขียน: admin/hr ทุกเอกสาร · accountant เงินเดือน + meta + period (stamp) · manager คำขอ ตารางกะ period meta
create or replace function public.plfl_can_write(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    r in ('admin', 'hr')
    or (r = 'accountant' and c in ('pay', 'meta', 'period'))
    or (r = 'manager' and c in ('requests', 'roster', 'period', 'meta')), false)
  from (select public.plfl_role() as r, public.plfl_doc_class(k) as c) x
$$;

create or replace function public.plfl_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.plfl_role() in ('admin', 'hr', 'accountant', 'manager'), false)
$$;

drop policy if exists plfl_profile_select on public.plfl_profile;
create policy plfl_profile_select on public.plfl_profile for select to authenticated
  using (user_id = auth.uid() or public.plfl_role() in ('admin', 'hr'));
-- แก้ไขผ่าน plfl_set_user() เท่านั้น

-- เข้าสู่ระบบครั้งแรก: สร้างโปรไฟล์สถานะ pending (รอผู้ดูแลกำหนดสิทธิ์)
create or replace function public.plfl_me() returns public.plfl_profile
language plpgsql security definer set search_path = public as $$
declare p public.plfl_profile;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.plfl_profile (user_id, email, name)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1))
  on conflict (user_id) do update set email = excluded.email
  returning * into p;
  return p;
end $$;

create or replace function public.plfl_set_user(p_user uuid, p_role text, p_name text, p_emp text)
returns public.plfl_profile
language plpgsql security definer set search_path = public as $$
declare p public.plfl_profile;
begin
  if public.plfl_role() is distinct from 'admin' then raise exception 'เฉพาะผู้ดูแลระบบ (admin)'; end if;
  if p_role <> 'admin' and exists (select 1 from public.plfl_profile where user_id = p_user and role = 'admin')
     and (select count(*) from public.plfl_profile where role = 'admin') <= 1 then
    raise exception 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน';
  end if;
  update public.plfl_profile set role = p_role, name = coalesce(nullif(p_name, ''), name), emp_id = nullif(p_emp, ''), updated_at = now()
  where user_id = p_user returning * into p;
  if p.user_id is null then raise exception 'ไม่พบผู้ใช้'; end if;
  insert into public.plfl_audit (user_id, user_name, doc, op, path, old, new)
  values (auth.uid(), (select name from public.plfl_profile where user_id = auth.uid()), 'users', 'role', p.email, null, to_jsonb(p_role));
  return p;
end $$;

-- ---------- เอกสารข้อมูล ----------
create table if not exists public.plfl_doc (
  key text primary key,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_name text
);
alter table public.plfl_doc enable row level security;

drop policy if exists plfl_doc_select on public.plfl_doc;
drop policy if exists plfl_doc_insert on public.plfl_doc;
drop policy if exists plfl_doc_update on public.plfl_doc;
drop policy if exists plfl_doc_delete on public.plfl_doc;
create policy plfl_doc_select on public.plfl_doc for select to authenticated using (public.plfl_can_read(key));
create policy plfl_doc_insert on public.plfl_doc for insert to authenticated with check (public.plfl_can_write(key));
create policy plfl_doc_update on public.plfl_doc for update to authenticated using (public.plfl_can_write(key)) with check (public.plfl_can_write(key));
create policy plfl_doc_delete on public.plfl_doc for delete to authenticated using (public.plfl_can_write(key));

-- ---------- ประวัติการแก้ไขระดับฟิลด์ ----------
create table if not exists public.plfl_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_name text,
  doc text not null,
  op text not null,
  path text,
  old jsonb,
  new jsonb,
  version integer
);
create index if not exists plfl_audit_at on public.plfl_audit (at desc);
create index if not exists plfl_audit_doc on public.plfl_audit (doc, at desc);
alter table public.plfl_audit enable row level security;
drop policy if exists plfl_audit_select on public.plfl_audit;
create policy plfl_audit_select on public.plfl_audit for select to authenticated
  using (public.plfl_role() in ('admin', 'hr'));

-- เทียบ jsonb ทีละฟิลด์ (ลงลึกได้ depth ชั้น) ข้ามคีย์ใหญ่ใน skip
create or replace function public.plfl_jdiff(a jsonb, b jsonb, path text, depth integer, skip text[])
returns table (p text, o jsonb, n jsonb)
language plpgsql immutable set search_path = public as $$
declare k text;
begin
  if a is not distinct from b then return; end if;
  if depth > 0 and a is not null and b is not null
     and jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
    for k in select jsonb_object_keys(a || b) loop
      if k = any (skip) then continue; end if;
      return query select * from public.plfl_jdiff(a -> k, b -> k, path || '.' || k, depth - 1, skip);
    end loop;
    return;
  end if;
  p := path; o := a; n := b;
  return next;
end $$;

create or replace function public.plfl_doc_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cls text := public.plfl_doc_class(coalesce(new.key, old.key));
  uname text := (select name from public.plfl_profile where user_id = auth.uid());
  skip text[] := array['mapping', 'calc', 'mapStats', 'rows', 'totals', 'p', 'notes'];
  n integer;
begin
  if tg_op = 'DELETE' then
    insert into public.plfl_audit (user_id, user_name, doc, op, version) values (auth.uid(), uname, old.key, 'delete', old.version);
    return old;
  end if;
  -- ข้อมูลปริมาณมาก (บันทึกเวลา) / ตัวนับ: บันทึกแค่ว่ามีการเปลี่ยน
  if cls in ('punches', 'imports', 'meta') then
    if tg_op = 'INSERT' or cls <> 'meta' then
      insert into public.plfl_audit (user_id, user_name, doc, op, version, new)
      values (auth.uid(), uname, new.key, lower(tg_op), new.version,
              case when jsonb_typeof(new.data) = 'array' then jsonb_build_object('rows', jsonb_array_length(new.data)) end);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into public.plfl_audit (user_id, user_name, doc, op, version) values (auth.uid(), uname, new.key, 'insert', new.version);
    return new;
  end if;
  select count(*) into n from public.plfl_jdiff(old.data, new.data, '', 3, skip);
  if n > 300 then
    insert into public.plfl_audit (user_id, user_name, doc, op, version, new)
    values (auth.uid(), uname, new.key, 'update', new.version, jsonb_build_object('fields', n));
  elsif n > 0 then
    insert into public.plfl_audit (user_id, user_name, doc, op, path, old, new, version)
    select auth.uid(), uname, new.key, 'update', nullif(d.p, ''),
           case when length(d.o::text) > 2000 then to_jsonb('…' || length(d.o::text) || ' ตัวอักษร') else d.o end,
           case when length(d.n::text) > 2000 then to_jsonb('…' || length(d.n::text) || ' ตัวอักษร') else d.n end,
           new.version
    from public.plfl_jdiff(old.data, new.data, '', 3, skip) d;
  end if;
  return new;
end $$;

drop trigger if exists plfl_doc_audit on public.plfl_doc;
create trigger plfl_doc_audit after insert or update or delete on public.plfl_doc
  for each row execute function public.plfl_doc_audit();

-- ---------- บันทึกหลายเอกสารในครั้งเดียว (ตรวจเวอร์ชัน) ----------
-- p_docs = [{ key, data, version }]   version 0 = เอกสารใหม่ · data null = ลบ
-- meta (ตัวนับ seq/counters) รวมค่ามากสุดฝั่งเซิร์ฟเวอร์ ไม่ต้องตรวจเวอร์ชัน
-- คืน { key: เวอร์ชันใหม่ } · ชนกัน → error 'conflict:<key>:<ผู้แก้ล่าสุด>'
create or replace function public.plfl_save(p_docs jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  d jsonb; k text; v integer; cur public.plfl_doc; out jsonb := '{}'; uname text; merged jsonb;
begin
  if not public.plfl_is_staff() then raise exception 'ไม่มีสิทธิ์บันทึกข้อมูล'; end if;
  uname := (select name from public.plfl_profile where user_id = auth.uid());
  for d in select * from jsonb_array_elements(p_docs) loop
    k := d ->> 'key';
    v := coalesce((d ->> 'version')::integer, 0);
    if not public.plfl_can_write(k) then raise exception 'ไม่มีสิทธิ์แก้ไขข้อมูล %', k; end if;
    select * into cur from public.plfl_doc where key = k for update;
    if k = 'meta' and cur.key is not null and d -> 'data' is not null and d -> 'data' <> 'null'::jsonb then
      merged := cur.data || (d -> 'data')
        || jsonb_build_object('seq', greatest(coalesce((cur.data ->> 'seq')::bigint, 0), coalesce((d -> 'data' ->> 'seq')::bigint, 0)))
        || jsonb_build_object('counters', (
             select coalesce(jsonb_object_agg(key, greatest(coalesce((cur.data -> 'counters' ->> key)::bigint, 0), coalesce((d -> 'data' -> 'counters' ->> key)::bigint, 0))), '{}')
             from jsonb_object_keys(coalesce(cur.data -> 'counters', '{}') || coalesce(d -> 'data' -> 'counters', '{}')) as key));
      update public.plfl_doc set data = merged, version = cur.version + 1, updated_at = now(), updated_by = auth.uid(), updated_by_name = uname where key = k;
      out := out || jsonb_build_object(k, cur.version + 1, 'meta_data', merged);
      continue;
    end if;
    if cur.key is not null and cur.version <> v then
      raise exception 'conflict:%:%', k, coalesce(cur.updated_by_name, '') using errcode = 'P0409';
    end if;
    if d -> 'data' is null or d -> 'data' = 'null'::jsonb then
      delete from public.plfl_doc where key = k;
      out := out || jsonb_build_object(k, 0);
    elsif cur.key is null then
      if v <> 0 then raise exception 'conflict:%:(ถูกลบ)', k using errcode = 'P0409'; end if;
      insert into public.plfl_doc (key, data, version, updated_by, updated_by_name) values (k, d -> 'data', 1, auth.uid(), uname);
      out := out || jsonb_build_object(k, 1);
    else
      update public.plfl_doc set data = d -> 'data', version = cur.version + 1, updated_at = now(), updated_by = auth.uid(), updated_by_name = uname where key = k;
      out := out || jsonb_build_object(k, cur.version + 1);
    end if;
  end loop;
  return out;
end $$;

-- ---------- ประวัติการทำงาน (ต่อท้ายอย่างเดียว) ----------
create table if not exists public.plfl_activity (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  by_name text,
  action text not null,
  detail text
);
create index if not exists plfl_activity_at on public.plfl_activity (at desc);
alter table public.plfl_activity enable row level security;
drop policy if exists plfl_activity_select on public.plfl_activity;
drop policy if exists plfl_activity_insert on public.plfl_activity;
create policy plfl_activity_select on public.plfl_activity for select to authenticated using (public.plfl_is_staff());
create policy plfl_activity_insert on public.plfl_activity for insert to authenticated
  with check (public.plfl_is_staff() and user_id = auth.uid());

-- ---------- สำรองข้อมูล ----------
create table if not exists public.plfl_backup (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null default 'auto' check (kind in ('auto', 'manual', 'pre-restore')),
  by_name text,
  docs jsonb not null,
  bytes integer not null default 0
);
alter table public.plfl_backup enable row level security;
drop policy if exists plfl_backup_select on public.plfl_backup;
create policy plfl_backup_select on public.plfl_backup for select to authenticated
  using (public.plfl_role() in ('admin', 'hr'));

-- สำรองทั้งหมด · kind = auto จะข้ามถ้าสำรองอัตโนมัติไปแล้วภายใน 20 ชม. · เก็บ auto 14 ชุด, manual 20 ชุด
create or replace function public.plfl_backup_now(p_kind text default 'manual') returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.plfl_backup; snap jsonb;
begin
  if coalesce(public.plfl_role(), '') not in ('admin', 'hr', 'accountant') then raise exception 'ไม่มีสิทธิ์สำรองข้อมูล'; end if;
  if p_kind not in ('auto', 'manual') then raise exception 'kind'; end if;
  if p_kind = 'auto' and exists (select 1 from public.plfl_backup where kind = 'auto' and at > now() - interval '20 hours') then
    return jsonb_build_object('skipped', true);
  end if;
  select coalesce(jsonb_object_agg(key, jsonb_build_object('data', data, 'version', version)), '{}') into snap from public.plfl_doc;
  if snap = '{}'::jsonb then return jsonb_build_object('skipped', true, 'empty', true); end if;
  insert into public.plfl_backup (kind, by_name, docs, bytes)
  values (p_kind, (select name from public.plfl_profile where user_id = auth.uid()), snap, length(snap::text))
  returning * into b;
  delete from public.plfl_backup where kind = 'auto' and id not in (select id from public.plfl_backup where kind = 'auto' order by at desc limit 14);
  delete from public.plfl_backup where kind in ('manual', 'pre-restore') and id not in (select id from public.plfl_backup where kind in ('manual', 'pre-restore') order by at desc limit 20);
  return jsonb_build_object('id', b.id, 'at', b.at, 'bytes', b.bytes);
end $$;

create or replace function public.plfl_backups() returns table (id bigint, at timestamptz, kind text, by_name text, bytes integer, docs integer)
language sql stable security invoker set search_path = public as $$
  select id, at, kind, by_name, bytes, (select count(*)::integer from jsonb_object_keys(docs)) from public.plfl_backup order by at desc
$$;

-- กู้คืนทั้งชุด (admin) — สำรองสถานะปัจจุบันเป็น pre-restore ก่อนเสมอ
create or replace function public.plfl_restore(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare src jsonb; snap jsonb; k text;
begin
  if public.plfl_role() is distinct from 'admin' then raise exception 'เฉพาะผู้ดูแลระบบ (admin)'; end if;
  select docs into src from public.plfl_backup where id = p_id;
  if src is null then raise exception 'ไม่พบชุดสำรอง %', p_id; end if;
  select coalesce(jsonb_object_agg(key, jsonb_build_object('data', data, 'version', version)), '{}') into snap from public.plfl_doc;
  insert into public.plfl_backup (kind, by_name, docs, bytes)
  values ('pre-restore', (select name from public.plfl_profile where user_id = auth.uid()), snap, length(snap::text));
  delete from public.plfl_doc where not (key = any (array(select jsonb_object_keys(src))));
  for k in select jsonb_object_keys(src) loop
    insert into public.plfl_doc (key, data, version, updated_by, updated_by_name)
    values (k, src -> k -> 'data', 1, auth.uid(), 'กู้คืนชุด #' || p_id)
    on conflict (key) do update set data = excluded.data, version = public.plfl_doc.version + 1, updated_at = now(),
      updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name;
  end loop;
  return jsonb_build_object('restored', p_id, 'docs', (select count(*) from jsonb_object_keys(src)));
end $$;

-- ---------- สิทธิ์เรียกใช้ ----------
revoke all on function public.plfl_role(), public.plfl_can_read(text), public.plfl_can_write(text), public.plfl_is_staff(),
  public.plfl_me(), public.plfl_set_user(uuid, text, text, text), public.plfl_save(jsonb),
  public.plfl_backup_now(text), public.plfl_backups(), public.plfl_restore(bigint),
  public.plfl_jdiff(jsonb, jsonb, text, integer, text[]), public.plfl_doc_audit() from public, anon;
grant execute on function public.plfl_role(), public.plfl_can_read(text), public.plfl_can_write(text), public.plfl_is_staff(),
  public.plfl_me(), public.plfl_set_user(uuid, text, text, text), public.plfl_save(jsonb),
  public.plfl_backup_now(text), public.plfl_backups(), public.plfl_restore(bigint) to authenticated;
revoke all on public.plfl_profile, public.plfl_doc, public.plfl_audit, public.plfl_activity, public.plfl_backup from anon;
grant select on public.plfl_profile, public.plfl_audit, public.plfl_backup to authenticated;
grant select, insert, update, delete on public.plfl_doc to authenticated;
grant select, insert on public.plfl_activity to authenticated;
grant usage on sequence public.plfl_activity_id_seq to authenticated;
