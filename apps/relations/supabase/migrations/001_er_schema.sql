-- =====================================================================
-- PeopleConnect · Employee Relation & Engagement (ER) — Core schema
-- ตารางทั้งหมดใช้ prefix "er_" อยู่ใน schema public (เหมือน hrd_ ของระบบ L&D)
-- เพื่อให้ Supabase API เรียกได้ทันทีโดยไม่ต้องเปิด exposed schema เพิ่ม
-- =====================================================================

-- ---------- 1) Master data (ซิงก์จาก HR Core: public.hr_db) ----------
create table if not exists er_departments (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  company     text,
  created_at  timestamptz not null default now()
);

create table if not exists er_employees (
  id            uuid primary key default gen_random_uuid(),
  employee_code text unique not null,
  first_name    text not null,
  last_name     text not null default '-',
  nickname      text,
  email         text,
  company       text,
  department_id uuid references er_departments(id) on delete set null,
  position_name text,
  job_level     smallint not null default 1,
  manager_id    uuid references er_employees(id) on delete set null,
  hire_date     date,
  end_date      date,
  status        text not null default 'active' check (status in ('active','probation','resigned')),
  avatar_url    text,
  auth_user_id  uuid unique,
  synced_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists er_employees_dept_idx on er_employees(department_id);
create index if not exists er_employees_mgr_idx on er_employees(manager_id);

-- สิทธิ์เฉพาะระบบ ER (นอกเหนือจาก admin/hr ที่ใช้ร่วมกับ hrd_user_roles / plfl_profile)
create table if not exists er_user_roles (
  auth_user_id uuid primary key,
  role         text not null check (role in ('admin','hr','er_officer','manager','culture_champion')),
  created_at   timestamptz not null default now()
);

-- ---------- 2) วัฒนธรรมองค์กร ----------
create table if not exists er_core_values (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name_th     text not null,
  name_en     text,
  description text,
  behaviors   text[] not null default '{}',
  icon        text not null default 'Sparkles',
  color       text not null default '#3B5BFD',
  sort_order  smallint not null default 0,
  is_active   boolean not null default true
);

create table if not exists er_culture_stories (
  id            uuid primary key default gen_random_uuid(),
  core_value_id uuid references er_core_values(id) on delete set null,
  title         text not null,
  body          text not null,
  author_id     uuid references er_employees(id) on delete set null,
  status        text not null default 'published' check (status in ('draft','published','archived')),
  created_at    timestamptz not null default now()
);

-- ---------- 3) สื่อสารองค์กร ----------
create table if not exists er_announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  summary      text,
  body         text not null,
  category     text not null default 'news' check (category in ('news','event','people','policy','announcement','ceo')),
  cover_theme  text not null default 'blue',
  cover_url    text,
  is_pinned    boolean not null default false,
  require_ack  boolean not null default false,
  audience     text not null default 'all',
  author_id    uuid references er_employees(id) on delete set null,
  status       text not null default 'published' check (status in ('draft','scheduled','published','archived')),
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table if not exists er_announcement_reads (
  announcement_id uuid references er_announcements(id) on delete cascade,
  employee_id     uuid references er_employees(id) on delete cascade,
  read_at         timestamptz not null default now(),
  acknowledged    boolean not null default false,
  reaction        text,
  primary key (announcement_id, employee_id)
);

-- ---------- 4) กิจกรรม & แคมเปญ ----------
create table if not exists er_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  event_type  text not null default 'activity' check (event_type in ('activity','campaign','townhall','csr','wellbeing','celebration','learning')),
  cover_theme text not null default 'green',
  cover_url   text,
  start_at    timestamptz not null,
  end_at      timestamptz,
  location    text,
  capacity    integer,
  points      integer not null default 0,
  organizer_id uuid references er_employees(id) on delete set null,
  status      text not null default 'open' check (status in ('draft','open','closed','completed','cancelled')),
  created_at  timestamptz not null default now()
);

create table if not exists er_event_participants (
  event_id    uuid references er_events(id) on delete cascade,
  employee_id uuid references er_employees(id) on delete cascade,
  status      text not null default 'registered' check (status in ('registered','attended','cancelled')),
  rating      smallint check (rating between 1 and 5),
  comment     text,
  registered_at timestamptz not null default now(),
  primary key (event_id, employee_id)
);

-- ---------- 5) การยกย่องและรางวัล ----------
create table if not exists er_badges (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  icon        text not null default 'Award',
  color       text not null default '#F59E0B',
  points      integer not null default 10
);

create table if not exists er_recognitions (
  id               uuid primary key default gen_random_uuid(),
  from_employee_id uuid not null references er_employees(id) on delete cascade,
  to_employee_id   uuid not null references er_employees(id) on delete cascade,
  core_value_id    uuid references er_core_values(id) on delete set null,
  badge_id         uuid references er_badges(id) on delete set null,
  message          text not null,
  points           integer not null default 10,
  visibility       text not null default 'public' check (visibility in ('public','team','private')),
  created_at       timestamptz not null default now(),
  check (from_employee_id <> to_employee_id)
);
create index if not exists er_recognitions_to_idx on er_recognitions(to_employee_id, created_at desc);

create table if not exists er_recognition_reactions (
  recognition_id uuid references er_recognitions(id) on delete cascade,
  employee_id    uuid references er_employees(id) on delete cascade,
  emoji          text not null default '👏',
  created_at     timestamptz not null default now(),
  primary key (recognition_id, employee_id)
);

create table if not exists er_awards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,                -- เช่น Employee of the Quarter, อายุงาน 10 ปี
  award_type  text not null default 'excellence' check (award_type in ('excellence','service_year','innovation','culture','team')),
  employee_id uuid references er_employees(id) on delete cascade,
  period      text,
  citation    text,
  awarded_at  date not null default current_date
);

-- ---------- 6) ความผูกพัน: แบบสำรวจ (Anonymous by design) ----------
create table if not exists er_surveys (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  survey_type  text not null default 'pulse' check (survey_type in ('engagement','pulse','enps','onboarding','exit','event')),
  is_anonymous boolean not null default true,
  min_group_size smallint not null default 5,   -- ไม่แสดงผลกลุ่มที่ผู้ตอบน้อยกว่านี้ (ปกป้องตัวตน)
  status       text not null default 'draft' check (status in ('draft','open','closed')),
  open_at      timestamptz,
  close_at     timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists er_survey_questions (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references er_surveys(id) on delete cascade,
  seq        smallint not null default 1,
  text       text not null,
  q_type     text not null default 'likert' check (q_type in ('likert','nps','text','choice')),
  dimension  text,          -- เช่น Leadership, Growth, Recognition, Wellbeing, Culture
  options    jsonb
);

-- ใครตอบแล้ว (ไม่ผูกกับคำตอบ)
create table if not exists er_survey_participation (
  survey_id    uuid references er_surveys(id) on delete cascade,
  employee_id  uuid references er_employees(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (survey_id, employee_id)
);

-- คำตอบ (ไม่มี employee_id เมื่อเป็นแบบไม่ระบุตัวตน)
create table if not exists er_survey_responses (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references er_surveys(id) on delete cascade,
  employee_id   uuid references er_employees(id) on delete set null,
  department_id uuid references er_departments(id) on delete set null,
  tenure_band   text,
  submitted_on  date not null default current_date
);

create table if not exists er_survey_answers (
  response_id uuid references er_survey_responses(id) on delete cascade,
  question_id uuid references er_survey_questions(id) on delete cascade,
  score       smallint,
  answer_text text,
  primary key (response_id, question_id)
);

-- ---------- 7) สวัสดิการและคุณภาพชีวิต ----------
create table if not exists er_wellbeing_programs (
  id          uuid primary key default gen_random_uuid(),
  pillar      text not null check (pillar in ('mental','physical','financial','social','worklife')),
  title       text not null,
  description text,
  format      text not null default 'content' check (format in ('content','program','service','benefit','challenge')),
  duration    text,
  link_url    text,
  cover_theme text not null default 'teal',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists er_wellbeing_checkins (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid references er_employees(id) on delete cascade,
  mood        smallint not null check (mood between 1 and 5),
  energy      smallint check (energy between 1 and 5),
  stress      smallint check (stress between 1 and 5),
  note        text,
  checkin_on  date not null default current_date,
  unique (employee_id, checkin_on)
);

-- ---------- 8) รับฟังและช่วยเหลือ (Voice of Employee) ----------
create table if not exists er_feedback (
  id           uuid primary key default gen_random_uuid(),
  feedback_type text not null default 'suggestion' check (feedback_type in ('suggestion','question','concern','praise','idea')),
  category     text not null default 'general',
  subject      text not null,
  body         text not null,
  is_anonymous boolean not null default false,
  employee_id  uuid references er_employees(id) on delete set null,  -- null เมื่อ anonymous
  status       text not null default 'new' check (status in ('new','in_review','answered','implemented','closed')),
  response     text,
  responded_by uuid references er_employees(id) on delete set null,
  responded_at timestamptz,
  upvotes      integer not null default 0,
  ref_code     text unique not null default upper(substr(md5(gen_random_uuid()::text), 1, 8)), -- ใช้ติดตามสถานะแบบไม่ระบุตัวตน
  created_at   timestamptz not null default now()
);

-- ---------- 9) ER Case Management (ร้องทุกข์ / ข้อพิพาท / วินัย) — HR only ----------
create sequence if not exists er_case_seq;
create table if not exists er_cases (
  id            uuid primary key default gen_random_uuid(),
  case_no       text unique not null default ('ER-' || to_char(now(),'YYYY') || '-' || lpad(nextval('er_case_seq')::text, 4, '0')),
  case_type     text not null check (case_type in ('grievance','conflict','harassment','misconduct','attendance','performance','policy','other')),
  severity      text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status        text not null default 'open' check (status in ('open','investigating','pending_action','resolved','closed')),
  title         text not null,
  description   text,
  channel       text not null default 'hr' check (channel in ('hr','hotline','manager','self_service','feedback')),
  reporter_id   uuid references er_employees(id) on delete set null,
  subject_id    uuid references er_employees(id) on delete set null,
  department_id uuid references er_departments(id) on delete set null,
  assigned_to   uuid references er_employees(id) on delete set null,
  is_confidential boolean not null default true,
  due_date      date,
  resolution    text,
  outcome       text check (outcome in ('no_action','coaching','verbal_warning','written_warning','suspension','termination','mediation','policy_change')),
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz
);

create table if not exists er_case_notes (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references er_cases(id) on delete cascade,
  author_id  uuid references er_employees(id) on delete set null,
  note_type  text not null default 'note' check (note_type in ('note','interview','evidence','action','status')),
  body       text not null,
  created_at timestamptz not null default now()
);

-- ---------- 10) People Journey (Attract → Offboard) ----------
create table if not exists er_journey_milestones (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references er_employees(id) on delete cascade,
  stage        text not null check (stage in ('attract','onboard','develop','engage','retain','offboard')),
  milestone    text not null,       -- เช่น day1, day30, probation, anniversary_1y, stay_interview, exit_interview
  title        text not null,
  due_date     date,
  owner_role   text not null default 'hr' check (owner_role in ('hr','manager','employee','buddy')),
  status       text not null default 'pending' check (status in ('pending','done','skipped','overdue')),
  completed_at timestamptz,
  note         text,
  unique (employee_id, milestone)
);

create table if not exists er_exit_interviews (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references er_employees(id) on delete cascade,
  last_day       date,
  reason_primary text check (reason_primary in ('career_growth','compensation','manager','worklife','relocation','culture','personal','retirement','other')),
  reason_detail  text,
  satisfaction   smallint check (satisfaction between 1 and 5),
  would_return   boolean,
  would_recommend boolean,
  regrettable    boolean,
  interviewed_by uuid references er_employees(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------- 11) Integration กับ HRM อื่นๆ ----------
create table if not exists er_integrations (
  system_code  text primary key,
  name         text not null,
  direction    text not null check (direction in ('inbound','outbound','both')),
  description  text,
  status       text not null default 'pending' check (status in ('connected','pending','error','disabled')),
  last_sync_at timestamptz,
  records      integer not null default 0
);

create table if not exists er_sync_logs (
  id          uuid primary key default gen_random_uuid(),
  system_code text references er_integrations(system_code) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'success',
  inserted    integer not null default 0,
  updated     integer not null default 0,
  message     text
);
