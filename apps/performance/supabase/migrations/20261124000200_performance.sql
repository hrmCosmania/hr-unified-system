set search_path = pm, public, extensions;
-- =====================================================================
-- GrowTogether PM · 0200 · Performance: cycles, goals/KPI, check-in, feedback, reviews, 360, calibration
-- =====================================================================
create type pm.cycle_status   as enum ('draft','active','closed');
create type pm.cycle_phase    as enum ('goal_setting','checkin','mid_year','feedback_360','year_end','calibration','result');
create type pm.plan_status    as enum ('not_started','goal_draft','goal_pending','goal_approved','self_review','manager_review','calibration','released','acknowledged');
create type pm.goal_type      as enum ('company','team','individual','development','probation');
create type pm.goal_status    as enum ('draft','pending_approval','approved','on_track','at_risk','off_track','completed','cancelled');
create type pm.kpi_direction  as enum ('higher_better','lower_better','target_exact');
create type pm.data_source    as enum ('manual','pos','mes','qms','tna','lms','crm');
create type pm.review_type    as enum ('self','manager','mid_year_self','mid_year_manager','probation');
create type pm.review_status  as enum ('not_started','draft','submitted','released','acknowledged');
create type pm.feedback_type  as enum ('praise','constructive','request');
create type pm.feedback_visibility as enum ('private','manager','public');
create type pm.rater_relation as enum ('self','manager','peer','direct_report','internal_customer');
create type pm.request_status as enum ('pending','in_progress','submitted','declined','expired');

-- ---------- Review cycle ----------
create table pm.review_cycles (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,               -- PMS-2026
  name_th       text not null,                      -- ประเมินผล 2026
  year          smallint not null,
  start_date    date not null,
  end_date      date not null,
  status        cycle_status not null default 'draft',
  rating_scale  jsonb not null default '[
     {"value":5,"label":"โดดเด่น"},{"value":4,"label":"เกินความคาดหวัง"},
     {"value":3,"label":"ตามความคาดหวัง"},{"value":2,"label":"ต้องพัฒนา"},{"value":1,"label":"ต่ำกว่ามาตรฐาน"}]',
  distribution_guideline jsonb default '{"5":10,"4":20,"3":50,"2":15,"1":5}',  -- % แนะนำ
  min_360_raters smallint not null default 3,       -- ปกปิดตัวตน: แสดงผลเมื่อมีผู้ตอบ ≥ N
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table pm.cycle_phases (
  id         uuid primary key default gen_random_uuid(),
  cycle_id   uuid not null references pm.review_cycles(id) on delete cascade,
  phase      cycle_phase not null,
  start_date date not null,
  end_date   date not null,
  sort_order smallint not null,
  unique (cycle_id, phase)
);

-- น้ำหนัก KPI : Competency แยกตามกลุ่มพนักงาน / BU
create table pm.cycle_weight_rules (
  id               uuid primary key default gen_random_uuid(),
  cycle_id         uuid not null references pm.review_cycles(id) on delete cascade,
  employee_group   employee_group,
  business_unit    business_unit,
  kpi_weight       numeric(5,2) not null,
  competency_weight numeric(5,2) not null,
  min_goals        smallint not null default 3,
  max_goals        smallint not null default 7,
  check (kpi_weight + competency_weight = 100)
);

-- ---------- Performance plan (พนักงาน 1 คน × 1 รอบ) ----------
create table pm.performance_plans (
  id               uuid primary key default gen_random_uuid(),
  cycle_id         uuid not null references pm.review_cycles(id) on delete cascade,
  employee_id      uuid not null references pm.employees(id) on delete cascade,
  manager_id       uuid references pm.employees(id),     -- snapshot หัวหน้าผู้ประเมิน
  status           plan_status not null default 'not_started',
  kpi_weight       numeric(5,2) not null default 70,
  competency_weight numeric(5,2) not null default 30,
  kpi_score        numeric(4,2),
  competency_score numeric(4,2),
  overall_score    numeric(4,2),
  final_rating     smallint check (final_rating between 1 and 5),
  calibrated_rating smallint check (calibrated_rating between 1 and 5),
  potential_rating smallint check (potential_rating between 1 and 3),  -- 1 ต่ำ 2 กลาง 3 สูง
  released_at      timestamptz,
  acknowledged_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (cycle_id, employee_id)
);
create index on pm.performance_plans(manager_id);

-- ---------- KPI library ----------
create table pm.kpi_library (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,               -- RT-SALES, RT-SHRINK, FC-YIELD, FC-DEFECT, SAFE-INC ...
  name_th       text not null,
  description   text,
  unit          text not null,                      -- บาท, %, คะแนน, ครั้ง
  direction     kpi_direction not null default 'higher_better',
  data_source   data_source not null default 'manual',
  aggregation   text not null default 'sum',        -- sum | avg | last
  job_family_id uuid references pm.job_families(id),
  business_unit business_unit,
  scoring_bands jsonb default '[{"min":0,"score":1},{"min":80,"score":2},{"min":95,"score":3},{"min":105,"score":4},{"min":115,"score":5}]',
  is_active     boolean not null default true
);

-- ค่าจริงจากระบบปฏิบัติการ (POS / MES / QMS / T&A) — scope ได้ทั้งรายคนและรายหน่วยงาน
create table pm.kpi_actuals (
  id            uuid primary key default gen_random_uuid(),
  kpi_id        uuid not null references pm.kpi_library(id),
  employee_id   uuid references pm.employees(id),
  org_unit_id   uuid references pm.org_units(id),
  period        date not null,                      -- วันแรกของเดือน
  value         numeric(18,4) not null,
  source        data_source not null,
  source_event_id text,
  recorded_at   timestamptz not null default now(),
  check (employee_id is not null or org_unit_id is not null)
);
create unique index kpi_actuals_uq on pm.kpi_actuals
  (kpi_id, coalesce(employee_id,'00000000-0000-0000-0000-000000000000'), coalesce(org_unit_id,'00000000-0000-0000-0000-000000000000'), period);

-- ---------- Goals ----------
create table pm.goals (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid references pm.performance_plans(id) on delete cascade,  -- null = เป้าบริษัท/หน่วยงาน
  cycle_id       uuid not null references pm.review_cycles(id) on delete cascade,
  employee_id    uuid references pm.employees(id) on delete cascade,
  org_unit_id    uuid references pm.org_units(id),                            -- เป้าระดับทีม/สาขา
  parent_goal_id uuid references pm.goals(id),                                -- cascade จากเป้าที่สูงกว่า
  type           goal_type not null default 'individual',
  title          text not null,
  description    text,
  kpi_id         uuid references pm.kpi_library(id),
  unit           text,
  direction      kpi_direction not null default 'higher_better',
  baseline       numeric(18,4),
  target         numeric(18,4),
  actual         numeric(18,4),
  weight         numeric(5,2) not null default 0 check (weight between 0 and 100),
  data_source    data_source not null default 'manual',
  progress_pct   numeric(6,2) generated always as (
                   case
                     when target is null or actual is null or target = 0 then null
                     when direction = 'lower_better' then round(least(200, (target / nullif(actual,0)) * 100), 2)
                     else round(least(200, (actual / target) * 100), 2)
                   end) stored,
  status         goal_status not null default 'draft',
  due_date       date,
  approved_by    uuid references pm.employees(id),
  approved_at    timestamptz,
  last_actual_at timestamptz,
  created_by     uuid references pm.employees(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on pm.goals(employee_id, cycle_id);
create index on pm.goals(plan_id);
create index on pm.goals(kpi_id);

create table pm.goal_updates (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references pm.goals(id) on delete cascade,
  actual      numeric(18,4),
  note        text,
  source      data_source not null default 'manual',
  evidence_path text,                                -- Supabase Storage
  created_by  uuid references pm.employees(id),
  created_at  timestamptz not null default now()
);

-- ---------- Check-in / Coaching ----------
create table pm.checkins (
  id             uuid primary key default gen_random_uuid(),
  cycle_id       uuid not null references pm.review_cycles(id),
  employee_id    uuid not null references pm.employees(id) on delete cascade,
  manager_id     uuid not null references pm.employees(id),
  checkin_date   date not null,
  went_well      text,          -- 1. เดือนนี้เป็นอย่างไรบ้าง?
  challenges     text,          -- 2. ติดอะไรอยู่?
  support_needed text,          -- 3. หัวหน้าช่วยอะไรได้บ้าง?
  next_steps     text,          -- 4. สิ่งที่จะทำต่อไป
  mood           smallint check (mood between 1 and 5),
  goal_snapshot  jsonb,         -- progress ของเป้า ณ วันที่ check-in
  next_checkin_date date,
  status         text not null default 'completed' check (status in ('scheduled','completed','cancelled')),
  created_by     uuid references pm.employees(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on pm.checkins(employee_id, checkin_date desc);

-- บันทึกส่วนตัวของหัวหน้า (แยกตารางเพื่อให้ RLS ปิดจากพนักงาน)
create table pm.checkin_private_notes (
  checkin_id  uuid primary key references pm.checkins(id) on delete cascade,
  author_id   uuid not null references pm.employees(id),
  note        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Feedback & Recognition ----------
create table pm.feedback (
  id              uuid primary key default gen_random_uuid(),
  from_employee_id uuid not null references pm.employees(id),
  to_employee_id   uuid not null references pm.employees(id),
  type            feedback_type not null,
  competency_id   uuid,                              -- FK ใน 0300
  goal_id         uuid references pm.goals(id),
  message         text not null,
  badge           text,                              -- customer_hero, team_player, safety_star, innovator, go_extra_mile
  visibility      feedback_visibility not null default 'manager',
  request_id      uuid references pm.feedback(id),  -- ตอบคำขอ feedback
  is_read         boolean not null default false,
  created_at      timestamptz not null default now(),
  check (from_employee_id <> to_employee_id)
);
create index on pm.feedback(to_employee_id, created_at desc);

-- ---------- Reviews (Self / Manager / Mid-year / Probation) ----------
create table pm.reviews (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references pm.performance_plans(id) on delete cascade,
  reviewer_id     uuid not null references pm.employees(id),
  review_type     review_type not null,
  status          review_status not null default 'not_started',
  kpi_score       numeric(4,2),
  competency_score numeric(4,2),
  overall_score   numeric(4,2),
  proposed_rating smallint check (proposed_rating between 1 and 5),
  strengths       text,
  improvements    text,
  overall_comment text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (plan_id, review_type)
);

create table pm.review_items (
  id            uuid primary key default gen_random_uuid(),
  review_id     uuid not null references pm.reviews(id) on delete cascade,
  goal_id       uuid references pm.goals(id) on delete cascade,
  competency_id uuid,                                -- FK ใน 0300
  rating        smallint check (rating between 1 and 5),
  comment       text,
  check ((goal_id is not null) <> (competency_id is not null))
);

-- ---------- 360° Feedback ----------
create table pm.feedback_360_requests (
  id                 uuid primary key default gen_random_uuid(),
  cycle_id           uuid not null references pm.review_cycles(id),
  subject_employee_id uuid not null references pm.employees(id),
  rater_employee_id  uuid not null references pm.employees(id),
  relation           rater_relation not null,
  status             request_status not null default 'pending',
  due_date           date,
  submitted_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (cycle_id, subject_employee_id, rater_employee_id)
);

create table pm.feedback_360_responses (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references pm.feedback_360_requests(id) on delete cascade,
  competency_id uuid not null,                       -- FK ใน 0300
  rating        smallint not null check (rating between 1 and 5),
  comment       text,
  unique (request_id, competency_id)
);

-- ---------- Calibration (9-Box) ----------
create table pm.calibration_sessions (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references pm.review_cycles(id),
  name_th       text not null,                       -- Calibration ภาคเหนือ - Retail
  org_unit_id   uuid references pm.org_units(id),
  business_unit business_unit,
  facilitator_id uuid references pm.employees(id),
  scheduled_at  timestamptz,
  status        text not null default 'planned' check (status in ('planned','in_progress','locked')),
  locked_at     timestamptz,
  created_at    timestamptz not null default now()
);

create table pm.calibration_members (
  session_id  uuid references pm.calibration_sessions(id) on delete cascade,
  employee_id uuid references pm.employees(id) on delete cascade,
  primary key (session_id, employee_id)
);

create table pm.calibration_entries (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references pm.calibration_sessions(id) on delete cascade,
  plan_id          uuid not null references pm.performance_plans(id) on delete cascade,
  pre_rating       smallint,                         -- คะแนนก่อนปรับ (จาก manager review)
  performance_level smallint check (performance_level between 1 and 3),  -- แกน X
  potential_level  smallint check (potential_level between 1 and 3),    -- แกน Y
  nine_box         smallint generated always as ((potential_level - 1) * 3 + performance_level) stored,
  calibrated_rating smallint check (calibrated_rating between 1 and 5),
  rationale        text,
  updated_by       uuid references pm.employees(id),
  updated_at       timestamptz not null default now(),
  unique (session_id, plan_id)
);

-- ---------- Notifications & Audit ----------
create table pm.notifications (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references pm.employees(id) on delete cascade,
  type        text not null,                         -- goal_approval, checkin_due, feedback_received, review_due ...
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  channels    text[] not null default '{in_app}',    -- in_app, line, email, push
  created_at  timestamptz not null default now()
);
create index on pm.notifications(employee_id, created_at desc);

create table pm.audit_log (
  id          bigserial primary key,
  actor_id    uuid,
  table_name  text not null,
  record_id   uuid,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

-- updated_at triggers
create trigger t_cycles_upd  before update on pm.review_cycles     for each row execute function pm.set_updated_at();
create trigger t_plans_upd   before update on pm.performance_plans for each row execute function pm.set_updated_at();
create trigger t_goals_upd   before update on pm.goals             for each row execute function pm.set_updated_at();
create trigger t_checkin_upd before update on pm.checkins          for each row execute function pm.set_updated_at();
create trigger t_reviews_upd before update on pm.reviews           for each row execute function pm.set_updated_at();

-- =====================================================================
-- Business logic
-- =====================================================================

-- สถานะเป้าหมายอัตโนมัติจาก % ความคืบหน้าเทียบกับเวลาที่ผ่านไปของรอบ
create or replace function pm.refresh_goal_status() returns trigger
language plpgsql set search_path = pm as $$
declare
  elapsed numeric;
  prog numeric;   -- คำนวณเอง: generated column ยังไม่ถูกคำนวณใน BEFORE trigger
  c record;
begin
  if new.status in ('draft','pending_approval','cancelled','completed')
     or new.target is null or new.actual is null or new.target = 0 then
    return new;
  end if;
  prog := case when new.direction = 'lower_better'
               then (new.target / nullif(new.actual, 0)) * 100
               else (new.actual / new.target) * 100 end;
  select start_date, end_date into c from pm.review_cycles where id = new.cycle_id;
  elapsed := greatest(0.05, least(1, (current_date - c.start_date)::numeric / nullif(c.end_date - c.start_date, 0)));
  -- KPI แบบ "น้อยดี" (เช่น % ของเสีย) หรือแบบค่าเฉลี่ย/อัตราส่วน เทียบกับเป้าโดยตรง ไม่ขึ้นกับเวลา
  if new.direction = 'lower_better'
     or exists (select 1 from pm.kpi_library k where k.id = new.kpi_id and k.aggregation <> 'sum') then
    elapsed := 1;
  end if;
  new.status := case
    when coalesce(prog, 0) >= elapsed * 100 * 0.95 then 'on_track'
    when coalesce(prog, 0) >= elapsed * 100 * 0.80 then 'at_risk'
    else 'off_track' end;
  return new;
end $$;
create trigger t_goal_status before insert or update of actual on pm.goals
  for each row execute function pm.refresh_goal_status();

-- ค่าจริงจาก POS/MES/QMS เข้ามา → อัปเดต actual ของเป้าที่ผูก KPI เดียวกัน (สะสมตั้งแต่ต้นรอบ)
create or replace function pm.apply_kpi_actual() returns trigger
language plpgsql security definer set search_path = pm as $$
declare k record;
begin
  select * into k from pm.kpi_library where id = new.kpi_id;
  update pm.goals g
     set actual = sub.val, last_actual_at = now()
    from (
      select g2.id,
             case k.aggregation
               when 'avg'  then avg(a.value)
               when 'last' then (array_agg(a.value order by a.period desc))[1]
               else sum(a.value) end as val
        from pm.goals g2
        join pm.review_cycles rc on rc.id = g2.cycle_id
        join pm.kpi_actuals a on a.kpi_id = g2.kpi_id
             and a.period between date_trunc('month', rc.start_date) and rc.end_date
             and ((g2.employee_id is not null and a.employee_id = g2.employee_id and g2.org_unit_id is null)
               or (g2.org_unit_id is not null and a.org_unit_id = g2.org_unit_id))
       where g2.kpi_id = new.kpi_id
         and g2.data_source = new.source
         and (g2.employee_id = new.employee_id or g2.org_unit_id = new.org_unit_id)
       group by g2.id
    ) sub
   where g.id = sub.id;
  return new;
end $$;
create trigger t_kpi_actual after insert or update on pm.kpi_actuals
  for each row execute function pm.apply_kpi_actual();

-- คำนวณคะแนน KPI จาก progress ตาม scoring band ของ KPI
create or replace function pm.score_from_progress(p numeric, bands jsonb) returns smallint
language sql immutable set search_path = pm as $$
  select coalesce((
    select (b->>'score')::smallint
      from jsonb_array_elements(coalesce(bands,
           '[{"min":0,"score":1},{"min":80,"score":2},{"min":95,"score":3},{"min":105,"score":4},{"min":115,"score":5}]')) b
     where p >= (b->>'min')::numeric
     order by (b->>'min')::numeric desc limit 1), 1)
$$;

-- คำนวณคะแนนรวมของ review (ถ่วงน้ำหนัก)
create or replace function pm.compute_review_scores(p_review_id uuid) returns void
language plpgsql security definer set search_path = pm as $$
declare r record; v_kpi numeric; v_comp numeric;
begin
  select rv.*, pp.kpi_weight, pp.competency_weight into r
    from pm.reviews rv join pm.performance_plans pp on pp.id = rv.plan_id
   where rv.id = p_review_id;

  select sum(ri.rating * g.weight) / nullif(sum(g.weight), 0) into v_kpi
    from pm.review_items ri join pm.goals g on g.id = ri.goal_id
   where ri.review_id = p_review_id and ri.rating is not null;

  select avg(ri.rating) into v_comp
    from pm.review_items ri
   where ri.review_id = p_review_id and ri.competency_id is not null and ri.rating is not null;

  update pm.reviews set
    kpi_score = round(v_kpi, 2),
    competency_score = round(v_comp, 2),
    overall_score = round(coalesce(v_kpi,0) * r.kpi_weight / 100 + coalesce(v_comp,0) * r.competency_weight / 100, 2)
  where id = p_review_id;
end $$;
