-- =====================================================================
-- PeopleConnect ER — Roles & Row Level Security
-- หลักการ: พนักงานเห็นเนื้อหาส่วนรวม + ข้อมูลของตัวเอง
--          HR/ER เห็นทั้งหมด ยกเว้นคำตอบแบบสำรวจนิรนาม (ดูได้เฉพาะผลรวมผ่าน RPC)
-- =====================================================================

create or replace function er_current_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from er_employees where auth_user_id = auth.uid() limit 1
$$;

-- ใช้สิทธิ์ admin/hr ร่วมกับระบบ L&D (hrd_user_roles) และ HR Portal (plfl_profile) ถ้ามี
create or replace function er_is_hr() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare ok boolean := false;
begin
  if auth.uid() is null then return false; end if;
  select exists (select 1 from er_user_roles where auth_user_id = auth.uid() and role in ('admin','hr','er_officer')) into ok;
  if ok then return true; end if;
  if to_regclass('public.hrd_user_roles') is not null then
    execute 'select exists (select 1 from public.hrd_user_roles where auth_user_id = $1 and role in (''admin'',''hr''))' into ok using auth.uid();
    if ok then return true; end if;
  end if;
  if to_regclass('public.plfl_profile') is not null then
    execute 'select exists (select 1 from public.plfl_profile where user_id = $1 and role in (''admin'',''hr''))' into ok using auth.uid();
  end if;
  return coalesce(ok, false);
end $$;

create or replace function er_is_manager_of(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, manager_id from er_employees where id = target
    union all
    select e.id, e.manager_id from er_employees e join chain c on e.id = c.manager_id
  )
  select exists (select 1 from chain where manager_id = er_current_employee_id())
$$;

create or replace function er_my_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when er_is_hr() then 'hr'
    when exists (select 1 from er_employees where manager_id = er_current_employee_id()) then 'manager'
    else 'employee' end
$$;

revoke execute on function er_current_employee_id(), er_is_hr(), er_is_manager_of(uuid), er_my_role() from public, anon;
grant execute on function er_current_employee_id(), er_is_hr(), er_is_manager_of(uuid), er_my_role() to authenticated;

-- ---------- เปิด RLS ทุกตาราง ----------
do $$
declare t text;
begin
  foreach t in array array[
    'er_departments','er_employees','er_user_roles','er_core_values','er_culture_stories',
    'er_announcements','er_announcement_reads','er_events','er_event_participants',
    'er_badges','er_recognitions','er_recognition_reactions','er_awards',
    'er_surveys','er_survey_questions','er_survey_participation','er_survey_responses','er_survey_answers',
    'er_wellbeing_programs','er_wellbeing_checkins','er_feedback','er_cases','er_case_notes',
    'er_journey_milestones','er_exit_interviews','er_integrations','er_sync_logs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
revoke all on sequence er_case_seq from anon;
grant usage on sequence er_case_seq to authenticated;

-- ---------- Master / reference: ทุกคนอ่านได้, HR เขียน ----------
create policy er_departments_read on er_departments for select to authenticated using (true);
create policy er_departments_hr   on er_departments for all    to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_employees_read on er_employees for select to authenticated using (true);
create policy er_employees_hr   on er_employees for all    to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_user_roles_read on er_user_roles for select to authenticated using (auth_user_id = auth.uid() or (select er_is_hr()));
create policy er_user_roles_hr   on er_user_roles for all    to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_core_values_read on er_core_values for select to authenticated using (true);
create policy er_core_values_hr   on er_core_values for all    to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_badges_read on er_badges for select to authenticated using (true);
create policy er_badges_hr   on er_badges for all    to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_awards_read on er_awards for select to authenticated using (true);
create policy er_awards_hr   on er_awards for all    to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_integrations_read on er_integrations for select to authenticated using (true);
create policy er_integrations_hr   on er_integrations for all    to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_sync_logs_hr on er_sync_logs for select to authenticated using ((select er_is_hr()));

-- ---------- วัฒนธรรม ----------
create policy er_stories_read on er_culture_stories for select to authenticated
  using (status = 'published' or author_id = (select er_current_employee_id()) or (select er_is_hr()));
create policy er_stories_insert on er_culture_stories for insert to authenticated
  with check (author_id = (select er_current_employee_id()) or (select er_is_hr()));
create policy er_stories_update on er_culture_stories for update to authenticated
  using (author_id = (select er_current_employee_id()) or (select er_is_hr()));
create policy er_stories_delete on er_culture_stories for delete to authenticated using ((select er_is_hr()));

-- ---------- สื่อสาร ----------
create policy er_ann_read on er_announcements for select to authenticated
  using ((status = 'published' and published_at <= now()) or (select er_is_hr()));
create policy er_ann_hr on er_announcements for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_ann_reads_own on er_announcement_reads for all to authenticated
  using (employee_id = (select er_current_employee_id()) or (select er_is_hr()))
  with check (employee_id = (select er_current_employee_id()));

-- ---------- กิจกรรม ----------
create policy er_events_read on er_events for select to authenticated using (status <> 'draft' or (select er_is_hr()));
create policy er_events_hr on er_events for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_ep_read on er_event_participants for select to authenticated using (true);
create policy er_ep_own on er_event_participants for insert to authenticated
  with check (employee_id = (select er_current_employee_id()) or (select er_is_hr()));
create policy er_ep_upd on er_event_participants for update to authenticated
  using (employee_id = (select er_current_employee_id()) or (select er_is_hr()));
create policy er_ep_del on er_event_participants for delete to authenticated
  using (employee_id = (select er_current_employee_id()) or (select er_is_hr()));

-- ---------- ยกย่อง ----------
create policy er_rec_read on er_recognitions for select to authenticated
  using (visibility = 'public'
         or from_employee_id = (select er_current_employee_id())
         or to_employee_id = (select er_current_employee_id())
         or (visibility = 'team' and er_is_manager_of(to_employee_id))
         or (select er_is_hr()));
create policy er_rec_insert on er_recognitions for insert to authenticated
  with check (from_employee_id = (select er_current_employee_id()));
create policy er_rec_delete on er_recognitions for delete to authenticated
  using (from_employee_id = (select er_current_employee_id()) or (select er_is_hr()));

create policy er_react_read on er_recognition_reactions for select to authenticated using (true);
create policy er_react_own on er_recognition_reactions for insert to authenticated with check (employee_id = (select er_current_employee_id()));
create policy er_react_del on er_recognition_reactions for delete to authenticated using (employee_id = (select er_current_employee_id()));

-- ---------- แบบสำรวจ ----------
create policy er_surveys_read on er_surveys for select to authenticated using (status <> 'draft' or (select er_is_hr()));
create policy er_surveys_hr on er_surveys for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_sq_read on er_survey_questions for select to authenticated
  using (exists (select 1 from er_surveys s where s.id = survey_id and (s.status <> 'draft' or (select er_is_hr()))));
create policy er_sq_hr on er_survey_questions for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

create policy er_sp_read on er_survey_participation for select to authenticated
  using (employee_id = (select er_current_employee_id()) or (select er_is_hr()));
-- การส่งคำตอบทำผ่าน RPC er_submit_survey() เท่านั้น (ไม่มี insert policy)

-- คำตอบดิบ: HR อ่านได้เฉพาะแบบสำรวจที่ "ไม่" นิรนาม
create policy er_sr_hr on er_survey_responses for select to authenticated
  using ((select er_is_hr()) and exists (select 1 from er_surveys s where s.id = survey_id and not s.is_anonymous));
create policy er_sa_hr on er_survey_answers for select to authenticated
  using ((select er_is_hr()) and exists (
    select 1 from er_survey_responses r join er_surveys s on s.id = r.survey_id
    where r.id = response_id and not s.is_anonymous));

-- ---------- Wellbeing ----------
create policy er_wp_read on er_wellbeing_programs for select to authenticated using (is_active or (select er_is_hr()));
create policy er_wp_hr on er_wellbeing_programs for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

-- check-in อารมณ์เป็นข้อมูลส่วนตัว: เจ้าของเท่านั้น (HR ดูภาพรวมผ่าน RPC)
create policy er_wc_own on er_wellbeing_checkins for all to authenticated
  using (employee_id = (select er_current_employee_id()))
  with check (employee_id = (select er_current_employee_id()));

-- ---------- Voice of Employee ----------
create policy er_fb_read on er_feedback for select to authenticated
  using (employee_id = (select er_current_employee_id()) or (select er_is_hr()));
create policy er_fb_insert on er_feedback for insert to authenticated
  with check ((is_anonymous and employee_id is null) or (not is_anonymous and employee_id = (select er_current_employee_id())));
create policy er_fb_hr on er_feedback for update to authenticated using ((select er_is_hr()));

-- ---------- ER Cases: HR/ER เท่านั้น (ผู้ร้องเห็นเคสของตัวเอง) ----------
create policy er_cases_read on er_cases for select to authenticated
  using ((select er_is_hr()) or reporter_id = (select er_current_employee_id()));
create policy er_cases_hr on er_cases for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));
create policy er_case_notes_hr on er_case_notes for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));

-- ---------- Journey ----------
create policy er_jm_read on er_journey_milestones for select to authenticated
  using (employee_id = (select er_current_employee_id()) or er_is_manager_of(employee_id) or (select er_is_hr()));
create policy er_jm_update on er_journey_milestones for update to authenticated
  using (er_is_manager_of(employee_id) or (select er_is_hr())
         or (employee_id = (select er_current_employee_id()) and owner_role = 'employee'));
create policy er_jm_hr on er_journey_milestones for insert to authenticated with check ((select er_is_hr()));
create policy er_jm_del on er_journey_milestones for delete to authenticated using ((select er_is_hr()));

create policy er_exit_hr on er_exit_interviews for all to authenticated using ((select er_is_hr())) with check ((select er_is_hr()));
