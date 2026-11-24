set search_path = pm, public, extensions;
-- =====================================================================
-- GrowTogether PM · 0300 · Development: competency, career path, IDP, LMS, talent pool, HR data
-- =====================================================================
create type pm.competency_category as enum ('core','leadership','functional');
create type pm.idp_action_type     as enum ('experience','exposure','education');   -- 70 / 20 / 10
create type pm.idp_action_status   as enum ('not_started','in_progress','completed','cancelled');
create type pm.readiness_level     as enum ('ready_now','ready_1_2y','ready_3y_plus');

create table pm.competencies (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                -- CORE-CUST, LEAD-PEOPLE, FN-RETAIL-OPS, FN-LEAN, FN-SAFETY
  name_th     text not null,
  name_en     text,
  category    competency_category not null,
  description text,
  is_active   boolean not null default true
);

create table pm.competency_levels (
  competency_id uuid references pm.competencies(id) on delete cascade,
  level         smallint check (level between 1 and 5),
  title_th      text not null,                    -- เริ่มต้น / พื้นฐาน / ชำนาญ / เชี่ยวชาญ / ต้นแบบ
  behaviors     text[] not null default '{}',     -- พฤติกรรมบ่งชี้
  primary key (competency_id, level)
);

create table pm.position_competencies (
  position_id    uuid references pm.positions(id) on delete cascade,
  competency_id  uuid references pm.competencies(id) on delete cascade,
  required_level smallint not null check (required_level between 1 and 5),
  weight         numeric(5,2) default 1,
  primary key (position_id, competency_id)
);

-- ผลประเมิน competency ล่าสุดของพนักงาน (มาจาก self/manager/360/recruitment assessment)
create table pm.competency_assessments (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references pm.employees(id) on delete cascade,
  competency_id uuid not null references pm.competencies(id),
  cycle_id      uuid references pm.review_cycles(id),
  level         numeric(3,1) not null check (level between 1 and 5),
  source        text not null check (source in ('self','manager','360','recruitment','calibrated')),
  assessed_by   uuid references pm.employees(id),
  assessed_at   timestamptz not null default now()
);
create index on pm.competency_assessments(employee_id, competency_id, assessed_at desc);

-- FK ที่ค้างจาก 0200
alter table pm.feedback               add constraint feedback_comp_fk   foreign key (competency_id) references pm.competencies(id);
alter table pm.review_items           add constraint ri_comp_fk         foreign key (competency_id) references pm.competencies(id);
alter table pm.feedback_360_responses add constraint r360_comp_fk       foreign key (competency_id) references pm.competencies(id);

-- ---------- Career path ----------
create table pm.career_paths (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,              -- RETAIL-STORE, FACTORY-PROD, FMCG-SALES
  name_th       text not null,
  job_family_id uuid references pm.job_families(id),
  business_unit business_unit
);

create table pm.career_path_steps (
  id                 uuid primary key default gen_random_uuid(),
  path_id            uuid not null references pm.career_paths(id) on delete cascade,
  position_id        uuid not null references pm.positions(id),
  step_order         smallint not null,
  min_tenure_months  smallint default 12,
  min_rating         smallint default 3,
  required_course_codes text[] default '{}',
  unique (path_id, step_order)
);

-- ---------- LMS mirror ----------
create table pm.lms_courses (
  id             uuid primary key default gen_random_uuid(),
  course_code    text not null unique,
  title_th       text not null,
  provider       text,
  delivery       text check (delivery in ('online','classroom','ojt','blended')),
  duration_hours numeric(5,1),
  competency_ids uuid[] not null default '{}',
  url            text,
  is_active      boolean not null default true,
  synced_at      timestamptz
);

create table pm.training_records (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references pm.employees(id) on delete cascade,
  course_id    uuid not null references pm.lms_courses(id),
  status       text not null check (status in ('enrolled','in_progress','completed','failed','cancelled')),
  score        numeric(5,2),
  completed_at timestamptz,
  source_event_id text,
  unique (employee_id, course_id)
);

-- ---------- IDP ----------
create table pm.idps (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references pm.employees(id) on delete cascade,
  cycle_id           uuid references pm.review_cycles(id),
  career_aspiration  text,
  target_position_id uuid references pm.positions(id),
  status             text not null default 'draft' check (status in ('draft','submitted','approved','closed')),
  approved_by        uuid references pm.employees(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (employee_id, cycle_id)
);

create table pm.idp_actions (
  id             uuid primary key default gen_random_uuid(),
  idp_id         uuid not null references pm.idps(id) on delete cascade,
  competency_id  uuid references pm.competencies(id),
  title          text not null,
  action_type    idp_action_type not null,
  lms_course_id  uuid references pm.lms_courses(id),
  mentor_id      uuid references pm.employees(id),
  start_date     date,
  due_date       date,
  status         idp_action_status not null default 'not_started',
  progress_pct   smallint not null default 0 check (progress_pct between 0 and 100),
  outcome_note   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger t_idps_upd    before update on pm.idps        for each row execute function pm.set_updated_at();
create trigger t_idpact_upd  before update on pm.idp_actions for each row execute function pm.set_updated_at();

-- เรียนจบใน LMS → ปิด IDP action ที่ผูกหลักสูตรนั้นอัตโนมัติ
create or replace function pm.sync_idp_from_training() returns trigger
language plpgsql security definer set search_path = pm as $$
begin
  if new.status = 'completed' then
    update pm.idp_actions a
       set status = 'completed', progress_pct = 100,
           outcome_note = coalesce(a.outcome_note, 'อบรมสำเร็จจาก LMS เมื่อ ' || to_char(new.completed_at, 'DD/MM/YYYY'))
      from pm.idps i
     where a.idp_id = i.id and i.employee_id = new.employee_id
       and a.lms_course_id = new.course_id and a.status <> 'completed';
  elsif new.status = 'in_progress' then
    update pm.idp_actions a set status = 'in_progress'
      from pm.idps i
     where a.idp_id = i.id and i.employee_id = new.employee_id
       and a.lms_course_id = new.course_id and a.status = 'not_started';
  end if;
  return new;
end $$;
create trigger t_training_idp after insert or update on pm.training_records
  for each row execute function pm.sync_idp_from_training();

-- ---------- Talent pool / Succession ----------
create table pm.talent_pool (
  id            uuid primary key default gen_random_uuid(),
  position_id   uuid not null references pm.positions(id),
  employee_id   uuid not null references pm.employees(id) on delete cascade,
  readiness     readiness_level not null,
  nominated_by  uuid references pm.employees(id),
  cycle_id      uuid references pm.review_cycles(id),
  note          text,
  created_at    timestamptz not null default now(),
  unique (position_id, employee_id)
);

-- ตำแหน่งว่างภายใน (จากระบบ Internal Job / Recruitment)
create table pm.internal_jobs (
  id            uuid primary key default gen_random_uuid(),
  external_id   text unique,
  position_id   uuid references pm.positions(id),
  org_unit_id   uuid references pm.org_units(id),
  title_th      text not null,
  close_date    date,
  status        text not null default 'open' check (status in ('open','closed')),
  synced_at     timestamptz
);

-- ---------- HR data จาก Time & Attendance ----------
create table pm.attendance_monthly (
  employee_id  uuid references pm.employees(id) on delete cascade,
  period       date not null,
  work_days    smallint,
  late_count   smallint,
  late_minutes integer,
  absent_days  numeric(4,1),
  leave_days   numeric(4,1),
  ot_hours     numeric(6,1),
  source_event_id text,
  primary key (employee_id, period)
);

-- =====================================================================
-- Gap analysis: ระดับปัจจุบัน vs ระดับที่ตำแหน่งปัจจุบัน/เป้าหมายต้องการ
-- =====================================================================
create or replace function pm.competency_gap(p_employee uuid, p_position uuid default null)
returns table (competency_id uuid, code text, name_th text, category competency_category,
               required_level smallint, current_level numeric, gap numeric)
language sql stable security definer set search_path = pm as $$
  with target as (
    select coalesce(p_position, e.position_id) as pos from pm.employees e where e.id = p_employee
  ), latest as (
    select distinct on (ca.competency_id) ca.competency_id, ca.level
      from pm.competency_assessments ca
     where ca.employee_id = p_employee
     order by ca.competency_id, (ca.source = 'calibrated') desc, ca.assessed_at desc
  )
  select c.id, c.code, c.name_th, c.category, pc.required_level,
         coalesce(l.level, 0), pc.required_level - coalesce(l.level, 0)
    from target t
    join pm.position_competencies pc on pc.position_id = t.pos
    join pm.competencies c on c.id = pc.competency_id
    left join latest l on l.competency_id = c.id
   where pm.can_view_employee(p_employee)
   order by (pc.required_level - coalesce(l.level, 0)) desc
$$;
