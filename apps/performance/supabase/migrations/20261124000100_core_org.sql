set search_path = pm, public, extensions;
-- =====================================================================
-- GrowTogether PM · 0100 · Extensions, enums, organization (mirror จาก Core HR)
-- =====================================================================
create extension if not exists pgcrypto;
-- pg_cron / pg_net ใช้เฉพาะงานตั้งเวลา → ดู 20261124000700_schedules.sql (เปิดใช้เมื่อ deploy Edge Functions แล้ว)

-- ---------- Schema แยกของระบบ PM (ไม่ยุ่งกับตารางเดิมใน public) ----------
-- ต้องเพิ่ม "pm" ใน Dashboard › Project Settings › Data API › Exposed schemas เพื่อให้ Web App เรียกได้
create schema if not exists pm;
grant usage on schema pm to authenticated, service_role;
alter default privileges in schema pm grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema pm grant all on tables to service_role;
alter default privileges in schema pm grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema pm grant execute on functions to authenticated, service_role;

-- ---------- Enums ----------
create type pm.business_unit   as enum ('hq','retail','fmcg','factory');
create type pm.org_unit_type   as enum ('company','division','department','region','area','store','factory','line','team');
create type pm.employee_group  as enum ('office','store','field_sales','factory');
create type pm.employee_status as enum ('active','probation','suspended','terminated');
create type pm.app_role        as enum ('employee','manager','hrbp','hr_admin','executive');

-- ---------- Common trigger ----------
create or replace function pm.set_updated_at() returns trigger
language plpgsql set search_path = pm as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- Organization ----------
create table pm.org_units (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,              -- รหัสจาก Core HR เช่น ST045, FC01-L3
  name_th        text not null,
  name_en        text,
  type           org_unit_type not null,
  business_unit  business_unit not null,
  parent_id      uuid references pm.org_units(id),
  head_employee_id uuid,                            -- FK เพิ่มด้านล่าง
  is_active      boolean not null default true,
  external_id    text,
  synced_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on pm.org_units(parent_id);

create table pm.job_families (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,                   -- RETAIL-OPS, PRODUCTION, SALES, SUPPLY, HQ-FIN ...
  name_th   text not null,
  business_unit business_unit
);

create table pm.positions (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  title_th         text not null,
  title_en         text,
  job_family_id    uuid references pm.job_families(id),
  job_level        smallint not null default 1,     -- 1=Staff … 8=Executive
  grade            text,
  is_people_manager boolean not null default false,
  is_critical      boolean not null default false,  -- ตำแหน่งสำคัญที่ต้องมี successor
  external_id      text,
  updated_at       timestamptz not null default now()
);

create table pm.employees (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users(id) on delete set null,
  employee_code   text not null unique,             -- รหัสพนักงาน (key หลักในการเชื่อมทุกระบบ)
  first_name_th   text not null,
  last_name_th    text not null,
  nickname        text,
  email           text,
  mobile          text,
  avatar_url      text,
  org_unit_id     uuid references pm.org_units(id),
  position_id     uuid references pm.positions(id),
  manager_id      uuid references pm.employees(id),
  employee_group  employee_group not null default 'office',
  status          employee_status not null default 'active',
  hire_date       date,
  position_start_date date,
  termination_date date,
  source          text not null default 'core_hr',
  external_id     text,
  synced_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on pm.employees(manager_id);
create index on pm.employees(org_unit_id);
create index on pm.employees(position_id);

alter table pm.org_units
  add constraint org_units_head_fk foreign key (head_employee_id) references pm.employees(id);

create table pm.user_roles (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references pm.employees(id) on delete cascade,
  role          app_role not null,
  scope_business_unit business_unit,               -- สำหรับ hrbp: ดูแล BU ไหน (null = ทั้งหมด)
  created_at    timestamptz not null default now(),
  unique (employee_id, role, scope_business_unit)
);

create trigger t_org_units_upd  before update on pm.org_units  for each row execute function pm.set_updated_at();
create trigger t_positions_upd  before update on pm.positions  for each row execute function pm.set_updated_at();
create trigger t_employees_upd  before update on pm.employees  for each row execute function pm.set_updated_at();

-- =====================================================================
-- Helper functions สำหรับ RLS (security definer เพื่อหลีกเลี่ยง recursion)
-- =====================================================================
create or replace function pm.current_employee_id() returns uuid
language sql stable security definer set search_path = pm as $$
  select id from pm.employees where user_id = auth.uid() limit 1
$$;

create or replace function pm.has_role(r app_role) returns boolean
language sql stable security definer set search_path = pm as $$
  select exists (
    select 1 from pm.user_roles ur
    where ur.employee_id = pm.current_employee_id() and ur.role = r
  )
$$;

create or replace function pm.is_hr() returns boolean
language sql stable security definer set search_path = pm as $$
  select pm.has_role('hr_admin') or pm.has_role('hrbp')
$$;

-- หัวหน้าทุกระดับในสายบังคับบัญชา (Manager chain) ของพนักงาน target
create or replace function pm.is_manager_of(target uuid) returns boolean
language sql stable security definer set search_path = pm as $$
  with recursive chain as (
    select e.manager_id, 1 as depth from pm.employees e where e.id = target
    union all
    select e.manager_id, c.depth + 1 from pm.employees e
      join chain c on e.id = c.manager_id
    where c.depth < 12
  )
  select exists (select 1 from chain where manager_id = pm.current_employee_id())
$$;

-- HRBP ที่ดูแล BU ของพนักงาน target
create or replace function pm.is_hrbp_of(target uuid) returns boolean
language sql stable security definer set search_path = pm as $$
  select exists (
    select 1
    from pm.employees e
    join pm.org_units o on o.id = e.org_unit_id
    join pm.user_roles ur on ur.employee_id = pm.current_employee_id()
    where e.id = target
      and (ur.role = 'hr_admin'
           or (ur.role = 'hrbp' and (ur.scope_business_unit is null or ur.scope_business_unit = o.business_unit)))
  )
$$;

-- สิทธิ์อ่านข้อมูลผลงานของพนักงาน: ตนเอง / หัวหน้าในสาย / HRBP / ผู้บริหาร
create or replace function pm.can_view_employee(target uuid) returns boolean
language sql stable security definer set search_path = pm as $$
  select target = pm.current_employee_id()
      or pm.is_manager_of(target)
      or pm.is_hrbp_of(target)
      or pm.has_role('executive')
$$;
