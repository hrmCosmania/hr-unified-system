set search_path = pm, public, extensions;
-- =====================================================================
-- GrowTogether PM · 0500 · Row Level Security
-- หลัก: ตนเอง / หัวหน้าในสาย / HRBP ของ BU / HR Admin / Executive (อ่าน)
-- ข้อมูลจาก Core HR เขียนได้เฉพาะ service_role (integration) — ผู้ใช้ทั่วไปอ่านอย่างเดียว
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array[
    'org_units','job_families','positions','employees','user_roles',
    'review_cycles','cycle_phases','cycle_weight_rules','performance_plans','kpi_library','kpi_actuals',
    'goals','goal_updates','checkins','checkin_private_notes','feedback','reviews','review_items',
    'feedback_360_requests','feedback_360_responses','calibration_sessions','calibration_members','calibration_entries',
    'notifications','audit_log','competencies','competency_levels','position_competencies','competency_assessments',
    'career_paths','career_path_steps','lms_courses','training_records','idps','idp_actions','talent_pool',
    'internal_jobs','attendance_monthly']
  loop execute format('alter table pm.%I enable row level security', t); end loop;
end $$;

-- ---------- ข้อมูลอ้างอิง: ผู้ใช้ที่ล็อกอินอ่านได้, HR Admin แก้ไขได้ ----------
do $$ declare t text; begin
  foreach t in array array['org_units','job_families','positions','review_cycles','cycle_phases','cycle_weight_rules',
                           'kpi_library','competencies','competency_levels','position_competencies',
                           'career_paths','career_path_steps','lms_courses','internal_jobs']
  loop
    execute format('create policy "read_all_%1$s" on pm.%1$I for select to authenticated using (true)', t);
    execute format('create policy "hr_admin_write_%1$s" on pm.%1$I for all to authenticated using (pm.has_role(''hr_admin'')) with check (pm.has_role(''hr_admin''))', t);
  end loop;
end $$;

-- ---------- Employees: ไดเรกทอรีอ่านได้ทุกคน (เฉพาะ active) ----------
create policy emp_read on pm.employees for select to authenticated
  using (status <> 'terminated' or pm.is_hr());
create policy emp_self_update on pm.employees for update to authenticated
  using (id = pm.current_employee_id())
  with check (id = pm.current_employee_id());   -- อัปเดตได้เฉพาะ nickname/avatar (จำกัดคอลัมน์ด้วย grant ด้านล่าง)
revoke update on pm.employees from authenticated;
grant update (nickname, avatar_url) on pm.employees to authenticated;

create policy roles_read on pm.user_roles for select to authenticated
  using (employee_id = pm.current_employee_id() or pm.has_role('hr_admin'));
create policy roles_admin on pm.user_roles for all to authenticated
  using (pm.has_role('hr_admin')) with check (pm.has_role('hr_admin'));

-- ---------- Performance plans ----------
create policy plan_read on pm.performance_plans for select to authenticated
  using (pm.can_view_employee(employee_id));
create policy plan_manager_update on pm.performance_plans for update to authenticated
  using (pm.is_manager_of(employee_id) or pm.is_hrbp_of(employee_id));
create policy plan_self_ack on pm.performance_plans for update to authenticated
  using (employee_id = pm.current_employee_id() and status = 'released')
  with check (employee_id = pm.current_employee_id() and status in ('released','acknowledged'));
create policy plan_hr_insert on pm.performance_plans for insert to authenticated
  with check (pm.is_hr());

-- ---------- Goals ----------
create policy goal_read on pm.goals for select to authenticated
  using (
    type = 'company'
    or (employee_id is not null and pm.can_view_employee(employee_id))
    or (org_unit_id is not null and exists (select 1 from pm.employees e
          where e.id = pm.current_employee_id() and e.org_unit_id = goals.org_unit_id))
    or pm.is_hr()
  );
-- พนักงานสร้าง/แก้เป้าตัวเองได้เฉพาะสถานะร่าง; หัวหน้าแก้/อนุมัติได้
create policy goal_self_write on pm.goals for insert to authenticated
  with check (employee_id = pm.current_employee_id() and status in ('draft','pending_approval'));
create policy goal_self_update on pm.goals for update to authenticated
  using (employee_id = pm.current_employee_id() and status in ('draft','pending_approval'))
  with check (employee_id = pm.current_employee_id() and status in ('draft','pending_approval'));
create policy goal_manager_write on pm.goals for all to authenticated
  using ((employee_id is not null and pm.is_manager_of(employee_id)) or pm.is_hr())
  with check ((employee_id is not null and pm.is_manager_of(employee_id)) or pm.is_hr());

create policy goal_upd_read on pm.goal_updates for select to authenticated
  using (exists (select 1 from pm.goals g where g.id = goal_id and (g.employee_id is null or pm.can_view_employee(g.employee_id))));
create policy goal_upd_insert on pm.goal_updates for insert to authenticated
  with check (created_by = pm.current_employee_id()
    and exists (select 1 from pm.goals g where g.id = goal_id
                and (g.employee_id = pm.current_employee_id() or pm.is_manager_of(g.employee_id))));

create policy kpi_actual_read on pm.kpi_actuals for select to authenticated
  using ((employee_id is not null and pm.can_view_employee(employee_id)) or org_unit_id is not null);

-- ---------- Check-in ----------
create policy checkin_read on pm.checkins for select to authenticated
  using (pm.can_view_employee(employee_id));
create policy checkin_write on pm.checkins for insert to authenticated
  with check (employee_id = pm.current_employee_id() or pm.is_manager_of(employee_id));
create policy checkin_update on pm.checkins for update to authenticated
  using (employee_id = pm.current_employee_id() or manager_id = pm.current_employee_id());
create policy private_note_owner on pm.checkin_private_notes for all to authenticated
  using (author_id = pm.current_employee_id())
  with check (author_id = pm.current_employee_id());

-- ---------- Feedback ----------
create policy feedback_read on pm.feedback for select to authenticated
  using (
    from_employee_id = pm.current_employee_id()
    or to_employee_id = pm.current_employee_id()
    or visibility = 'public'
    or (visibility = 'manager' and pm.is_manager_of(to_employee_id))
    or pm.has_role('hr_admin')
  );
create policy feedback_send on pm.feedback for insert to authenticated
  with check (from_employee_id = pm.current_employee_id());
create policy feedback_mark_read on pm.feedback for update to authenticated
  using (to_employee_id = pm.current_employee_id());

-- ---------- Reviews ----------
-- พนักงานเห็น self review ของตนเอง และ manager review เมื่อ release แล้วเท่านั้น
create policy review_read on pm.reviews for select to authenticated
  using (
    reviewer_id = pm.current_employee_id()
    or exists (select 1 from pm.performance_plans p where p.id = plan_id and (
          pm.is_manager_of(p.employee_id) or pm.is_hrbp_of(p.employee_id) or pm.has_role('executive')
          or (p.employee_id = pm.current_employee_id()
              and (reviews.review_type in ('self','mid_year_self') or reviews.status in ('released','acknowledged')))))
  );
create policy review_write on pm.reviews for insert to authenticated
  with check (reviewer_id = pm.current_employee_id());
create policy review_update on pm.reviews for update to authenticated
  using (reviewer_id = pm.current_employee_id() and status in ('not_started','draft'))
  with check (reviewer_id = pm.current_employee_id());
create policy review_hr on pm.reviews for update to authenticated
  using (pm.is_hr());

create policy review_items_read on pm.review_items for select to authenticated
  using (exists (select 1 from pm.reviews r where r.id = review_id));   -- สืบทอดสิทธิ์จาก reviews (RLS ซ้อน)
create policy review_items_write on pm.review_items for all to authenticated
  using (exists (select 1 from pm.reviews r where r.id = review_id and r.reviewer_id = pm.current_employee_id() and r.status in ('not_started','draft')))
  with check (exists (select 1 from pm.reviews r where r.id = review_id and r.reviewer_id = pm.current_employee_id() and r.status in ('not_started','draft')));

-- ---------- 360 ----------
-- ผู้ถูกประเมินเห็น "ใครถูกเชิญ" (สถานะ) แต่ไม่เห็นคำตอบรายคน; คำตอบเห็นเฉพาะผู้ตอบ + HR Admin
create policy r360_req_read on pm.feedback_360_requests for select to authenticated
  using (rater_employee_id = pm.current_employee_id()
         or subject_employee_id = pm.current_employee_id()
         or pm.is_manager_of(subject_employee_id) or pm.is_hr());
create policy r360_req_create on pm.feedback_360_requests for insert to authenticated
  with check (subject_employee_id = pm.current_employee_id() or pm.is_manager_of(subject_employee_id) or pm.is_hr());
create policy r360_req_update on pm.feedback_360_requests for update to authenticated
  using (rater_employee_id = pm.current_employee_id() or pm.is_hr());

create policy r360_resp_rater on pm.feedback_360_responses for all to authenticated
  using (exists (select 1 from pm.feedback_360_requests q where q.id = request_id
                 and q.rater_employee_id = pm.current_employee_id() and q.status <> 'submitted'))
  with check (exists (select 1 from pm.feedback_360_requests q where q.id = request_id
                 and q.rater_employee_id = pm.current_employee_id() and q.status <> 'submitted'));
create policy r360_resp_hr on pm.feedback_360_responses for select to authenticated
  using (pm.has_role('hr_admin'));

-- ---------- Calibration ----------
create policy cal_session_read on pm.calibration_sessions for select to authenticated
  using (pm.is_hr() or pm.has_role('executive')
         or exists (select 1 from pm.calibration_members m where m.session_id = calibration_sessions.id and m.employee_id = pm.current_employee_id()));
create policy cal_session_write on pm.calibration_sessions for all to authenticated
  using (pm.is_hr()) with check (pm.is_hr());
create policy cal_member_read on pm.calibration_members for select to authenticated
  using (pm.is_hr() or employee_id = pm.current_employee_id());
create policy cal_member_write on pm.calibration_members for all to authenticated
  using (pm.is_hr()) with check (pm.is_hr());
create policy cal_entry_read on pm.calibration_entries for select to authenticated
  using (exists (select 1 from pm.calibration_sessions s where s.id = session_id));
create policy cal_entry_write on pm.calibration_entries for all to authenticated
  using (pm.is_hr() or exists (select 1 from pm.calibration_sessions s join pm.calibration_members m on m.session_id = s.id
          where s.id = session_id and s.status <> 'locked' and m.employee_id = pm.current_employee_id()))
  with check (pm.is_hr() or exists (select 1 from pm.calibration_sessions s join pm.calibration_members m on m.session_id = s.id
          where s.id = session_id and s.status <> 'locked' and m.employee_id = pm.current_employee_id()));

-- ---------- Development ----------
create policy comp_assess_read on pm.competency_assessments for select to authenticated
  using (pm.can_view_employee(employee_id));
create policy comp_assess_write on pm.competency_assessments for insert to authenticated
  with check (assessed_by = pm.current_employee_id()
              and ((employee_id = pm.current_employee_id() and source = 'self')
                   or (pm.is_manager_of(employee_id) and source = 'manager')
                   or pm.is_hr()));

create policy training_read on pm.training_records for select to authenticated
  using (pm.can_view_employee(employee_id));
create policy attendance_read on pm.attendance_monthly for select to authenticated
  using (pm.can_view_employee(employee_id));

create policy idp_read on pm.idps for select to authenticated using (pm.can_view_employee(employee_id));
create policy idp_write on pm.idps for all to authenticated
  using (employee_id = pm.current_employee_id() or pm.is_manager_of(employee_id) or pm.is_hr())
  with check (employee_id = pm.current_employee_id() or pm.is_manager_of(employee_id) or pm.is_hr());
create policy idp_act_read on pm.idp_actions for select to authenticated
  using (exists (select 1 from pm.idps i where i.id = idp_id));
create policy idp_act_write on pm.idp_actions for all to authenticated
  using (exists (select 1 from pm.idps i where i.id = idp_id and
         (i.employee_id = pm.current_employee_id() or pm.is_manager_of(i.employee_id) or pm.is_hr())))
  with check (exists (select 1 from pm.idps i where i.id = idp_id and
         (i.employee_id = pm.current_employee_id() or pm.is_manager_of(i.employee_id) or pm.is_hr())));

create policy talent_read on pm.talent_pool for select to authenticated
  using (pm.is_hr() or pm.has_role('executive') or pm.is_manager_of(employee_id));
create policy talent_write on pm.talent_pool for all to authenticated
  using (pm.is_hr()) with check (pm.is_hr());

-- ---------- Notifications / Audit ----------
create policy notif_own on pm.notifications for select to authenticated using (employee_id = pm.current_employee_id());
create policy notif_mark on pm.notifications for update to authenticated using (employee_id = pm.current_employee_id());
create policy audit_admin on pm.audit_log for select to authenticated using (pm.has_role('hr_admin'));
