-- =====================================================================
-- ผลประเมิน → Calibration → ล็อกผล → แจ้งผล → รับทราบ — 2026-11-25
-- 1) หัวหน้าส่งแบบประเมิน → คะแนน KPI / Competency / รวม และเกรดที่หัวหน้าเสนอ (ปัด 1–5) เข้าแผนประเมิน
--    สถานะแผน: ประเมินตนเองส่งแล้ว → manager_review · หัวหน้าส่งแล้ว → calibration
-- 2) Calibration: เหตุผลการปรับ (calibration_note) · ล็อกผล (locked_at) — ล็อกแล้วแก้เกรด/ศักยภาพไม่ได้
-- 3) แจ้งผล (HR): released + released_at · รับทราบ (พนักงานหรือ HR บันทึกแทน): acknowledged + acknowledged_at
--    การแจ้งผลยังส่งต่อเข้า outbox (pm_integration.on_plan_released) ตามเดิม
-- =====================================================================
alter table pm.performance_plans add column if not exists calibration_note text;
alter table pm.performance_plans add column if not exists locked_at timestamptz;
alter table pm.performance_plans add column if not exists locked_by uuid;
alter table pm.performance_plans add column if not exists released_by uuid;

create or replace function pm.compute_review_scores(p_review_id uuid)
 returns void language plpgsql security definer set search_path to 'pm' as $function$
declare r record; v_kpi numeric; v_comp numeric; v_overall numeric;
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
  v_overall := round(coalesce(v_kpi,0) * r.kpi_weight / 100 + coalesce(v_comp,0) * r.competency_weight / 100, 2);
  update pm.reviews set kpi_score = round(v_kpi, 2), competency_score = round(v_comp, 2), overall_score = v_overall
  where id = p_review_id;

  -- ส่งต่อเข้าแผนประเมิน (ยังไม่ล็อก/ยังไม่แจ้งผล)
  if r.status in ('submitted', 'released', 'acknowledged') then
    if r.review_type = 'manager' then
      update pm.performance_plans set kpi_score = round(v_kpi, 2), competency_score = round(v_comp, 2), overall_score = v_overall,
        final_rating = least(5, greatest(1, round(v_overall)::int)),
        status = case when status in ('released', 'acknowledged') then status else 'calibration'::pm.plan_status end, updated_at = now()
      where id = r.plan_id and locked_at is null;
    elsif r.review_type = 'self' then
      update pm.performance_plans set status = 'manager_review', updated_at = now()
      where id = r.plan_id and status not in ('calibration', 'released', 'acknowledged');
    end if;
  end if;
end $function$;

-- ล็อกแล้วห้ามแก้เกรด/ศักยภาพ/คะแนน (ยกเว้นปลดล็อกในคำสั่งเดียวกัน)
create or replace function pm.t_plan_lock_guard() returns trigger language plpgsql as $$
begin
  if old.locked_at is not null and new.locked_at is not null and (
       new.calibrated_rating is distinct from old.calibrated_rating or new.potential_rating is distinct from old.potential_rating
    or new.final_rating is distinct from old.final_rating or new.overall_score is distinct from old.overall_score) then
    raise exception 'ผลประเมินนี้ล็อกแล้ว — ปลดล็อกที่หน้า Calibration ก่อนแก้ไข';
  end if;
  return new;
end $$;
drop trigger if exists t_plan_lock_guard on pm.performance_plans;
create trigger t_plan_lock_guard before update on pm.performance_plans for each row execute function pm.t_plan_lock_guard();

create or replace function pm.lock_calibration(p_plan_ids uuid[], p_lock boolean default true) returns int
language plpgsql security definer set search_path = pm, public as $$
declare n int;
begin
  if not pm.is_hr() then raise exception 'เฉพาะ HR เท่านั้น'; end if;
  if p_lock then
    update pm.performance_plans set locked_at = now(), locked_by = auth.uid(),
      calibrated_rating = coalesce(calibrated_rating, final_rating), updated_at = now()
    where id = any(p_plan_ids) and locked_at is null and coalesce(calibrated_rating, final_rating) is not null;
  else
    update pm.performance_plans set locked_at = null, locked_by = null, updated_at = now()
    where id = any(p_plan_ids) and locked_at is not null and status not in ('released', 'acknowledged');
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function pm.release_results(p_plan_ids uuid[]) returns int
language plpgsql security definer set search_path = pm, public as $$
declare n int;
begin
  if not pm.is_hr() then raise exception 'เฉพาะ HR เท่านั้น'; end if;
  update pm.performance_plans set status = 'released', released_at = now(), released_by = auth.uid(), updated_at = now()
  where id = any(p_plan_ids) and locked_at is not null and status not in ('released', 'acknowledged');
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function pm.acknowledge_result(p_plan_id uuid) returns boolean
language plpgsql security definer set search_path = pm, public as $$
declare v_emp uuid;
begin
  select employee_id into v_emp from pm.performance_plans where id = p_plan_id and status = 'released';
  if v_emp is null then raise exception 'ยังไม่ได้แจ้งผล หรือรับทราบไปแล้ว'; end if;
  if v_emp is distinct from pm.current_employee_id() and not pm.is_hr() then raise exception 'รับทราบได้เฉพาะเจ้าของผลประเมิน (หรือ HR บันทึกแทน)'; end if;
  update pm.performance_plans set status = 'acknowledged', acknowledged_at = now(), updated_at = now() where id = p_plan_id;
  return true;
end $$;

revoke execute on function pm.lock_calibration(uuid[], boolean), pm.release_results(uuid[]), pm.acknowledge_result(uuid) from public, anon;
grant execute on function pm.lock_calibration(uuid[], boolean), pm.release_results(uuid[]), pm.acknowledge_result(uuid) to authenticated;

-- ย้อนหลัง: แบบประเมินหัวหน้าที่ส่งแล้ว → คำนวณและส่งต่อเข้าแผนประเมิน
do $$ declare x uuid; begin
  for x in select id from pm.reviews where status in ('submitted', 'released', 'acknowledged') loop perform pm.compute_review_scores(x); end loop;
end $$;
