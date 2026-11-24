-- =====================================================================
--  PeopleGrow HRD Platform — Database schema (Supabase / PostgreSQL)
--  ระบบบริหารและพัฒนาบุคลากร (HRD) สำหรับธุรกิจ Retail / FMCG / Factory
--
--  ตารางทั้งหมดใช้ prefix  hrd_  ใน schema public เพื่อให้อยู่ร่วมกับ
--  ระบบ HRM อื่น ๆ ในฐานข้อมูลเดียวกันได้โดยไม่ชนกัน และเรียกผ่าน
--  Supabase REST API ได้ทันทีโดยไม่ต้องตั้งค่า exposed schema เพิ่ม
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) โครงสร้างองค์กร (Master data — sync มาจาก HR Core)
-- ---------------------------------------------------------------------
create table if not exists hrd_business_units (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,              -- RETAIL / FMCG / FACTORY / HQ
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists hrd_departments (
  id               uuid primary key default gen_random_uuid(),
  business_unit_id uuid references hrd_business_units(id),
  code             text unique not null,
  name             text not null,
  hrm_org_unit_id  integer,                       -- อ้างอิง org_unit.id ของระบบ HRM
  created_at       timestamptz not null default now()
);

create table if not exists hrd_positions (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  name             text not null,
  job_level        smallint not null default 1,   -- 1=Operator ... 7=Executive
  career_track     text not null default 'operation', -- operation / store / sales / supply_chain / support / management
  is_key_position  boolean not null default false,
  hrm_position_id  integer,                       -- อ้างอิง position.id ของระบบ HRM
  created_at       timestamptz not null default now()
);

create table if not exists hrd_employees (
  id               uuid primary key default gen_random_uuid(),
  employee_code    text unique not null,
  first_name       text not null,
  last_name        text not null,
  nickname         text,
  email            text,
  gender           text,
  business_unit_id uuid references hrd_business_units(id),
  department_id    uuid references hrd_departments(id),
  position_id      uuid references hrd_positions(id),
  manager_id       uuid references hrd_employees(id),
  hire_date        date,
  status           text not null default 'active' check (status in ('active','probation','resigned')),
  auth_user_id     uuid unique,                    -- ผูกกับ auth.users เพื่อ Self-service
  hrm_employee_id  integer,                        -- อ้างอิง employee.id ของระบบ HRM
  synced_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists hrd_employees_bu_idx   on hrd_employees(business_unit_id);
create index if not exists hrd_employees_pos_idx  on hrd_employees(position_id);
create index if not exists hrd_employees_hrm_idx  on hrd_employees(hrm_employee_id);

-- บทบาทผู้ใช้งานในระบบ HRD
create table if not exists hrd_user_roles (
  auth_user_id uuid primary key,
  role         text not null check (role in ('admin','hr','manager','employee')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) Competency Management
-- ---------------------------------------------------------------------
create table if not exists hrd_competencies (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  type        text not null check (type in ('core','managerial','functional','technical')),
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists hrd_position_competencies (
  id             uuid primary key default gen_random_uuid(),
  position_id    uuid not null references hrd_positions(id) on delete cascade,
  competency_id  uuid not null references hrd_competencies(id) on delete cascade,
  required_level smallint not null check (required_level between 1 and 5),
  unique (position_id, competency_id)
);

create table if not exists hrd_competency_assessments (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references hrd_employees(id) on delete cascade,
  competency_id  uuid not null references hrd_competencies(id) on delete cascade,
  period         text not null,                    -- เช่น 2026
  self_level     smallint check (self_level between 1 and 5),
  manager_level  smallint check (manager_level between 1 and 5),
  final_level    smallint check (final_level between 1 and 5),
  assessed_at    timestamptz not null default now(),
  unique (employee_id, competency_id, period)
);

-- ---------------------------------------------------------------------
-- 3) Learning Management — หลักสูตร
-- ---------------------------------------------------------------------
create table if not exists hrd_courses (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  title         text not null,
  category      text not null,                     -- Leadership / Functional / Soft Skill / Safety / Compliance / Digital
  format        text not null check (format in ('classroom','e-learning','blended','ojt')),
  level         text not null default 'basic' check (level in ('basic','intermediate','advanced')),
  hours         numeric(6,1) not null default 0,
  description   text,
  objectives    text[],
  target_bu     text[],                            -- ['RETAIL','FACTORY',...] ว่าง = ทุกสายงาน
  is_mandatory  boolean not null default false,
  validity_months smallint,                        -- อายุใบรับรอง (เช่น Safety ต้องต่ออายุ)
  pass_score    smallint not null default 70,
  status        text not null default 'published' check (status in ('draft','published','archived')),
  created_at    timestamptz not null default now()
);

create table if not exists hrd_course_competencies (
  course_id     uuid not null references hrd_courses(id) on delete cascade,
  competency_id uuid not null references hrd_competencies(id) on delete cascade,
  primary key (course_id, competency_id)
);

create table if not exists hrd_course_modules (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references hrd_courses(id) on delete cascade,
  seq        smallint not null,
  title      text not null,
  type       text not null check (type in ('video','pdf','quiz','workshop','assignment')),
  minutes    smallint not null default 0,
  content_url text
);

-- ---------------------------------------------------------------------
-- 4) Training Management — รุ่นอบรม / วิทยากร / ลงทะเบียน
-- ---------------------------------------------------------------------
create table if not exists hrd_trainers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('internal','external')),
  expertise   text,
  employee_id uuid references hrd_employees(id),
  rating      numeric(3,2),
  created_at  timestamptz not null default now()
);

create table if not exists hrd_training_sessions (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references hrd_courses(id) on delete cascade,
  batch_no    smallint not null default 1,
  start_date  date not null,
  end_date    date not null,
  start_time  time default '09:00',
  end_time    time default '16:00',
  venue       text,
  trainer_id  uuid references hrd_trainers(id),
  capacity    smallint not null default 30,
  cost        numeric(12,2) not null default 0,
  status      text not null default 'open' check (status in ('planned','open','full','ongoing','completed','cancelled')),
  created_at  timestamptz not null default now()
);
create index if not exists hrd_sessions_course_idx on hrd_training_sessions(course_id);

create table if not exists hrd_enrollments (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references hrd_training_sessions(id) on delete cascade,
  employee_id      uuid not null references hrd_employees(id) on delete cascade,
  status           text not null default 'requested'
                    check (status in ('requested','approved','rejected','attended','completed','failed','no_show')),
  source           text not null default 'self' check (source in ('self','manager','hr','idp','mandatory')),
  approved_by      uuid references hrd_employees(id),
  approved_at      timestamptz,
  attended_hours   numeric(6,1),
  -- Kirkpatrick Evaluation
  satisfaction     numeric(3,2),                  -- L1 Reaction (1-5)
  pre_score        smallint,                      -- L2 Learning
  post_score       smallint,
  behavior_score   numeric(3,2),                  -- L3 Behavior (ประเมินโดยหัวหน้า 1-5)
  result_note      text,                          -- L4 Result
  created_at       timestamptz not null default now(),
  unique (session_id, employee_id)
);
create index if not exists hrd_enroll_emp_idx on hrd_enrollments(employee_id);

create table if not exists hrd_certificates (
  id            uuid primary key default gen_random_uuid(),
  cert_no       text unique not null,
  enrollment_id uuid references hrd_enrollments(id) on delete set null,
  employee_id   uuid not null references hrd_employees(id) on delete cascade,
  course_id     uuid not null references hrd_courses(id) on delete cascade,
  score         smallint,
  issued_at     date not null default current_date,
  expires_at    date
);

-- ---------------------------------------------------------------------
-- 5) Development Plan (IDP) — 70:20:10
-- ---------------------------------------------------------------------
create table if not exists hrd_idps (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references hrd_employees(id) on delete cascade,
  year         smallint not null,
  goal         text,
  target_position_id uuid references hrd_positions(id),
  status       text not null default 'draft' check (status in ('draft','submitted','approved','in_progress','completed')),
  approved_by  uuid references hrd_employees(id),
  created_at   timestamptz not null default now(),
  unique (employee_id, year)
);

create table if not exists hrd_idp_items (
  id             uuid primary key default gen_random_uuid(),
  idp_id         uuid not null references hrd_idps(id) on delete cascade,
  competency_id  uuid references hrd_competencies(id),
  method         text not null check (method in ('training','ojt','coaching','project','self_learning')), -- 10 / 70 / 20
  course_id      uuid references hrd_courses(id),
  title          text not null,
  target_date    date,
  progress       smallint not null default 0 check (progress between 0 and 100),
  status         text not null default 'not_started' check (status in ('not_started','in_progress','completed','overdue')),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6) Career & Succession
-- ---------------------------------------------------------------------
create table if not exists hrd_career_paths (
  id                uuid primary key default gen_random_uuid(),
  from_position_id  uuid not null references hrd_positions(id) on delete cascade,
  to_position_id    uuid not null references hrd_positions(id) on delete cascade,
  min_years         numeric(4,1) not null default 1,
  min_performance   text default 'B',
  required_course_ids uuid[] default '{}',
  note              text,
  unique (from_position_id, to_position_id)
);

create table if not exists hrd_talent_reviews (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references hrd_employees(id) on delete cascade,
  year         smallint not null,
  performance  smallint not null check (performance between 1 and 3),  -- 1 Low / 2 Medium / 3 High
  potential    smallint not null check (potential between 1 and 3),
  is_talent    boolean generated always as (performance + potential >= 5) stored,
  flight_risk  text default 'low' check (flight_risk in ('low','medium','high')),
  note         text,
  unique (employee_id, year)
);

create table if not exists hrd_succession_plans (
  id              uuid primary key default gen_random_uuid(),
  position_id     uuid not null references hrd_positions(id) on delete cascade,
  department_id   uuid references hrd_departments(id),
  incumbent_id    uuid references hrd_employees(id),
  vacancy_risk    text not null default 'medium' check (vacancy_risk in ('low','medium','high')),
  created_at      timestamptz not null default now()
);

create table if not exists hrd_succession_candidates (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references hrd_succession_plans(id) on delete cascade,
  employee_id uuid not null references hrd_employees(id) on delete cascade,
  readiness   text not null check (readiness in ('ready_now','1_2_years','3_plus_years')),
  readiness_pct smallint default 0,
  unique (plan_id, employee_id)
);

-- ---------------------------------------------------------------------
-- 7) ข้อมูลจากระบบอื่น / Budget / ข่าวสาร / Integration
-- ---------------------------------------------------------------------
create table if not exists hrd_performance_results (   -- snapshot จาก Performance Management
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references hrd_employees(id) on delete cascade,
  year         smallint not null,
  score        numeric(5,2),
  grade        text,                               -- A / B / C / D
  source_ref   text,
  unique (employee_id, year)
);

create table if not exists hrd_training_budgets (
  id               uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references hrd_business_units(id),
  year             smallint not null,
  budget           numeric(14,2) not null,
  unique (business_unit_id, year)
);

create table if not exists hrd_announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  category    text default 'news',
  published_at date not null default current_date,
  created_at  timestamptz not null default now()
);

create table if not exists hrd_integrations (
  id           uuid primary key default gen_random_uuid(),
  system_code  text unique not null,              -- HR_CORE / RECRUITMENT / TIME / PERFORMANCE / COMP_BEN / PAYROLL
  name         text not null,
  direction    text not null check (direction in ('inbound','outbound','both')),
  description  text,
  status       text not null default 'connected' check (status in ('connected','warning','disconnected')),
  last_sync_at timestamptz,
  records      integer default 0
);

create table if not exists hrd_sync_logs (
  id           uuid primary key default gen_random_uuid(),
  system_code  text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null check (status in ('success','partial','failed')),
  inserted     integer default 0,
  updated      integer default 0,
  message      text
);

-- ---------------------------------------------------------------------
-- 8) Views สำหรับ Dashboard / Report
-- ---------------------------------------------------------------------
create or replace view hrd_v_course_stats with (security_invoker = true) as
select c.id as course_id, c.code, c.title, c.category, c.format,
       count(distinct s.id)                                         as sessions,
       count(e.id) filter (where e.status in ('completed','attended')) as completed,
       round(avg(e.satisfaction)::numeric, 2)                        as avg_satisfaction,
       round(avg(e.post_score - e.pre_score)::numeric, 1)            as avg_score_gain
from hrd_courses c
left join hrd_training_sessions s on s.course_id = c.id
left join hrd_enrollments e on e.session_id = s.id
group by c.id;

create or replace view hrd_v_competency_gap with (security_invoker = true) as
select e.id as employee_id, e.employee_code, e.first_name, e.last_name,
       pc.competency_id, co.name as competency_name,
       pc.required_level, coalesce(a.final_level, 0) as current_level,
       greatest(pc.required_level - coalesce(a.final_level, 0), 0) as gap
from hrd_employees e
join hrd_position_competencies pc on pc.position_id = e.position_id
join hrd_competencies co on co.id = pc.competency_id
left join lateral (
  select final_level from hrd_competency_assessments x
  where x.employee_id = e.id and x.competency_id = pc.competency_id
  order by period desc limit 1
) a on true;

-- ---------------------------------------------------------------------
-- 9) Row Level Security
--    - ทุกคนที่ login อ่านข้อมูลได้ (ตัวกรองข้อมูลส่วนบุคคลทำใน policy ด้านล่าง)
--    - admin / hr แก้ไขได้ทั้งหมด
--    - พนักงานลงทะเบียนอบรม / แก้ IDP / ประเมินตนเอง ของตัวเองได้
-- ---------------------------------------------------------------------
create or replace function hrd_current_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from hrd_user_roles where auth_user_id = auth.uid()), 'employee')
$$;

create or replace function hrd_is_hr() returns boolean
language sql stable security definer set search_path = public as $$
  select hrd_current_role() in ('admin','hr')
$$;

create or replace function hrd_my_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from hrd_employees where auth_user_id = auth.uid()
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'hrd_business_units','hrd_departments','hrd_positions','hrd_employees','hrd_user_roles',
    'hrd_competencies','hrd_position_competencies','hrd_competency_assessments',
    'hrd_courses','hrd_course_competencies','hrd_course_modules','hrd_trainers',
    'hrd_training_sessions','hrd_enrollments','hrd_certificates','hrd_idps','hrd_idp_items',
    'hrd_career_paths','hrd_talent_reviews','hrd_succession_plans','hrd_succession_candidates',
    'hrd_performance_results','hrd_training_budgets','hrd_announcements','hrd_integrations','hrd_sync_logs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%s_read" on %I', t, t);
    execute format('drop policy if exists "%s_hr_write" on %I', t, t);
    execute format('create policy "%s_hr_write" on %I for all to authenticated using (hrd_is_hr()) with check (hrd_is_hr())', t, t);
  end loop;
end $$;

-- ข้อมูลทั่วไป: ทุกคนที่ login อ่านได้
do $$
declare t text;
begin
  foreach t in array array[
    'hrd_business_units','hrd_departments','hrd_positions','hrd_employees',
    'hrd_competencies','hrd_position_competencies','hrd_courses','hrd_course_competencies',
    'hrd_course_modules','hrd_trainers','hrd_training_sessions','hrd_career_paths',
    'hrd_announcements','hrd_integrations']
  loop
    execute format('create policy "%s_read" on %I for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- ข้อมูลรายบุคคล: เจ้าของ / หัวหน้า / HR เท่านั้น
create or replace function hrd_can_see_employee(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select hrd_is_hr()
      or emp = hrd_my_employee_id()
      or exists (select 1 from hrd_employees where id = emp and manager_id = hrd_my_employee_id())
$$;

do $$
declare t text;
begin
  foreach t in array array['hrd_competency_assessments','hrd_enrollments','hrd_certificates',
                           'hrd_idps','hrd_talent_reviews','hrd_performance_results']
  loop
    execute format('create policy "%s_read" on %I for select to authenticated using (hrd_can_see_employee(employee_id))', t, t);
  end loop;
end $$;

create policy "hrd_idp_items_read" on hrd_idp_items for select to authenticated
  using (exists (select 1 from hrd_idps i where i.id = idp_id and hrd_can_see_employee(i.employee_id)));
create policy "hrd_succession_plans_read" on hrd_succession_plans for select to authenticated
  using (hrd_current_role() in ('admin','hr','manager'));
create policy "hrd_succession_candidates_read" on hrd_succession_candidates for select to authenticated
  using (hrd_current_role() in ('admin','hr','manager'));
create policy "hrd_user_roles_read" on hrd_user_roles for select to authenticated
  using (auth_user_id = auth.uid() or hrd_is_hr());

-- Self-service writes
create policy "hrd_enroll_self_insert" on hrd_enrollments for insert to authenticated
  with check (employee_id = hrd_my_employee_id() and status = 'requested');
create policy "hrd_enroll_manager_update" on hrd_enrollments for update to authenticated
  using (exists (select 1 from hrd_employees e where e.id = employee_id and e.manager_id = hrd_my_employee_id()));
create policy "hrd_idp_self_write" on hrd_idps for all to authenticated
  using (employee_id = hrd_my_employee_id()) with check (employee_id = hrd_my_employee_id());
create policy "hrd_idp_items_self_write" on hrd_idp_items for all to authenticated
  using (exists (select 1 from hrd_idps i where i.id = idp_id and i.employee_id = hrd_my_employee_id()))
  with check (exists (select 1 from hrd_idps i where i.id = idp_id and i.employee_id = hrd_my_employee_id()));
create policy "hrd_assess_self_write" on hrd_competency_assessments for all to authenticated
  using (hrd_can_see_employee(employee_id)) with check (hrd_can_see_employee(employee_id));
