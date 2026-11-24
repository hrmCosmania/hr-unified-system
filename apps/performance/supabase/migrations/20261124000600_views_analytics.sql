set search_path = pm, public, extensions;
-- =====================================================================
-- GrowTogether PM · 0600 · Views & RPC สำหรับหน้าจอ (security_invoker = เคารพ RLS)
-- =====================================================================

-- Hub: สรุปเป้าหมายของพนักงานในรอบ
create or replace view pm.v_goal_summary with (security_invoker = true) as
select g.cycle_id, g.employee_id,
       count(*) filter (where g.status not in ('cancelled'))                    as total_goals,
       count(*) filter (where g.status in ('on_track','completed','approved'))  as on_track,
       count(*) filter (where g.status = 'at_risk')                             as at_risk,
       count(*) filter (where g.status = 'off_track')                           as off_track,
       count(*) filter (where g.status in ('draft','pending_approval'))         as not_started,
       sum(g.weight) filter (where g.status <> 'cancelled')                     as total_weight,
       round(avg(least(g.progress_pct, 100)) filter (where g.progress_pct is not null), 1) as avg_progress
  from pm.goals g
 where g.employee_id is not null
 group by g.cycle_id, g.employee_id;

-- My Team: ภาพรวมลูกทีม 1 แถว / คน
create or replace view pm.v_team_overview with (security_invoker = true) as
select e.id as employee_id, e.employee_code, e.first_name_th, e.last_name_th, e.nickname, e.avatar_url,
       e.manager_id, p.title_th as position_title, o.name_th as org_unit_name, o.business_unit,
       pp.cycle_id, pp.status as plan_status, pp.overall_score, pp.final_rating,
       gs.total_goals, gs.avg_progress, gs.at_risk, gs.off_track,
       case when coalesce(gs.off_track,0) > 0 then 'off_track'
            when coalesce(gs.at_risk,0)  > 0 then 'at_risk'
            when coalesce(gs.total_goals,0) = 0 then 'no_goal'
            else 'on_track' end as health,
       (select max(c.checkin_date) from pm.checkins c where c.employee_id = e.id) as last_checkin_date
  from pm.employees e
  left join pm.positions p on p.id = e.position_id
  left join pm.org_units o on o.id = e.org_unit_id
  left join pm.performance_plans pp on pp.employee_id = e.id
       and pp.cycle_id = (select id from pm.review_cycles where status = 'active' order by year desc limit 1)
  left join pm.v_goal_summary gs on gs.employee_id = e.id and gs.cycle_id = pp.cycle_id
 where e.status <> 'terminated';

-- งานที่ต้องทำ (To-do) ของผู้ใช้ปัจจุบัน
create or replace function pm.my_todos()
returns table (kind text, title text, subtitle text, due_date date, link text, priority smallint)
language sql stable security definer set search_path = pm as $$
  with me as (select pm.current_employee_id() as id),
       cyc as (select id from pm.review_cycles where status = 'active' order by year desc limit 1)
  -- เป้าหมายที่ยังเป็นร่าง
  select 'goal', 'ยืนยันเป้าหมาย ' || count(*) || ' ข้อ', 'รอส่งให้หัวหน้าอนุมัติ',
         (select end_date from pm.cycle_phases where cycle_id = (select id from cyc) and phase = 'goal_setting'),
         '/goals', 1::smallint
    from pm.goals g, me where g.employee_id = me.id and g.status = 'draft' and g.cycle_id = (select id from cyc)
  having count(*) > 0
  union all
  -- เป้าหมายของลูกทีมที่รออนุมัติ
  select 'approve', 'อนุมัติเป้าหมายลูกทีม ' || count(*) || ' รายการ', 'รอการอนุมัติจากคุณ', null, '/team', 1::smallint
    from pm.goals g where g.status = 'pending_approval' and pm.is_manager_of(g.employee_id)
  having count(*) > 0
  union all
  -- Check-in ที่ถึงกำหนด
  select 'checkin', 'นัด Check-in กับ' || case when c.employee_id = me.id then 'หัวหน้า' else 'ลูกทีม' end,
         'กำหนด ' || to_char(c.next_checkin_date, 'DD/MM'), c.next_checkin_date, '/checkin', 2::smallint
    from pm.checkins c, me
   where (c.employee_id = me.id or c.manager_id = me.id) and c.next_checkin_date between current_date and current_date + 14
  union all
  -- แบบประเมินที่ต้องทำ
  select 'review', case r.review_type when 'self' then 'ประเมินตนเอง' else 'ประเมินลูกทีม' end,
         'สถานะ: ' || r.status, null, '/review', 1::smallint
    from pm.reviews r, me where r.reviewer_id = me.id and r.status in ('not_started','draft')
  union all
  -- 360 ที่ได้รับเชิญ
  select '360', 'ประเมิน 360° ให้เพื่อนร่วมงาน ' || count(*) || ' คน', 'ครบกำหนด ' || to_char(min(q.due_date), 'DD/MM'),
         min(q.due_date), '/360', 2::smallint
    from pm.feedback_360_requests q, me where q.rater_employee_id = me.id and q.status in ('pending','in_progress')
  having count(*) > 0
  union all
  -- Feedback ใหม่
  select 'feedback', 'มี Feedback ใหม่ ' || count(*) || ' รายการ', 'จากเพื่อนร่วมงาน', null, '/feedback', 3::smallint
    from pm.feedback f, me where f.to_employee_id = me.id and not f.is_read
  having count(*) > 0
  order by 6, 4 nulls last
$$;

-- 360 summary: ค่าเฉลี่ยราย competency × ความสัมพันธ์ (ซ่อนกลุ่มที่มีผู้ตอบ < min_360_raters, ยกเว้น self/manager)
create or replace function pm.feedback_360_summary(p_employee uuid, p_cycle uuid)
returns table (competency_id uuid, competency_name text, relation rater_relation, avg_rating numeric, raters int)
language sql stable security definer set search_path = pm as $$
  select c.id, c.name_th, q.relation, round(avg(r.rating), 2), count(distinct q.id)::int
    from pm.feedback_360_requests q
    join pm.feedback_360_responses r on r.request_id = q.id
    join pm.competencies c on c.id = r.competency_id
    join pm.review_cycles rc on rc.id = q.cycle_id
   where q.subject_employee_id = p_employee and q.cycle_id = p_cycle and q.status = 'submitted'
     and pm.can_view_employee(p_employee)
   group by c.id, c.name_th, q.relation, rc.min_360_raters
  having q.relation in ('self','manager') or count(distinct q.id) >= rc.min_360_raters
$$;

-- Analytics (HR Director): completion & distribution ราย BU
create or replace function pm.analytics_cycle_overview(p_cycle uuid)
returns table (business_unit business_unit, headcount bigint, goal_set_pct numeric, checkin_pct numeric,
               self_review_pct numeric, manager_review_pct numeric, avg_score numeric,
               r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint)
language sql stable security definer set search_path = pm as $$
  select o.business_unit, count(*),
         round(100.0 * count(*) filter (where pp.status >= 'goal_approved') / nullif(count(*),0), 1),
         round(100.0 * count(*) filter (where exists (select 1 from pm.checkins c where c.employee_id = e.id
                     and c.checkin_date > current_date - 45)) / nullif(count(*),0), 1),
         round(100.0 * count(*) filter (where exists (select 1 from pm.reviews r where r.plan_id = pp.id
                     and r.review_type = 'self' and r.status <> 'not_started' and r.status <> 'draft')) / nullif(count(*),0), 1),
         round(100.0 * count(*) filter (where exists (select 1 from pm.reviews r where r.plan_id = pp.id
                     and r.review_type = 'manager' and r.status in ('submitted','released','acknowledged'))) / nullif(count(*),0), 1),
         round(avg(pp.overall_score), 2),
         count(*) filter (where coalesce(pp.calibrated_rating, pp.final_rating) = 1),
         count(*) filter (where coalesce(pp.calibrated_rating, pp.final_rating) = 2),
         count(*) filter (where coalesce(pp.calibrated_rating, pp.final_rating) = 3),
         count(*) filter (where coalesce(pp.calibrated_rating, pp.final_rating) = 4),
         count(*) filter (where coalesce(pp.calibrated_rating, pp.final_rating) = 5)
    from pm.performance_plans pp
    join pm.employees e on e.id = pp.employee_id
    join pm.org_units o on o.id = e.org_unit_id
   where pp.cycle_id = p_cycle and (pm.is_hr() or pm.has_role('executive'))
   group by o.business_unit
$$;

-- Skill gap ขององค์กร (Top competency gaps)
create or replace function pm.analytics_competency_gaps(p_business_unit business_unit default null)
returns table (competency_id uuid, name_th text, employees_with_gap bigint, avg_gap numeric)
language sql stable security definer set search_path = pm as $$
  with latest as (
    select distinct on (ca.employee_id, ca.competency_id) ca.employee_id, ca.competency_id, ca.level
      from pm.competency_assessments ca order by ca.employee_id, ca.competency_id, ca.assessed_at desc
  )
  select c.id, c.name_th, count(*) filter (where pc.required_level > coalesce(l.level,0)),
         round(avg(greatest(0, pc.required_level - coalesce(l.level,0))), 2)
    from pm.employees e
    join pm.org_units o on o.id = e.org_unit_id
    join pm.position_competencies pc on pc.position_id = e.position_id
    join pm.competencies c on c.id = pc.competency_id
    left join latest l on l.employee_id = e.id and l.competency_id = c.id
   where e.status <> 'terminated' and (p_business_unit is null or o.business_unit = p_business_unit)
     and (pm.is_hr() or pm.has_role('executive'))
   group by c.id, c.name_th
   order by 4 desc
   limit 10
$$;

-- Realtime: ให้หน้าจออัปเดตทันทีเมื่อ KPI/Feedback/Notification เปลี่ยน
alter publication supabase_realtime add table pm.goals, pm.feedback, pm.notifications;
