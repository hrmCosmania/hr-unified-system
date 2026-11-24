// =====================================================================
// Data access layer — เรียก Supabase ตาม schema ใน supabase/migrations
// ทุกฟังก์ชันพึ่ง RLS ฝั่งฐานข้อมูล (ไม่ต้องกรองสิทธิ์ซ้ำใน client)
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Checkin, Feedback, Goal, IntegrationSource, Todo } from "./types";

function db() {
  if (!supabase) throw new Error("Supabase is not configured (demo mode)");
  return supabase;
}

// ---------- Auth ----------
export const auth = {
  /** SSO สำหรับพนักงานสำนักงาน (ตั้งค่า Azure/Google provider ใน Supabase Auth) */
  signInWithSSO: (domain: string) => db().auth.signInWithSSO({ domain }),
  /** พนักงานหน้าร้าน/โรงงาน: รหัสพนักงาน → เบอร์มือถือที่ลงทะเบียน → OTP (ผ่าน Edge Function lookup) */
  sendOtp: (phone: string) => db().auth.signInWithOtp({ phone }),
  verifyOtp: (phone: string, token: string) => db().auth.verifyOtp({ phone, token, type: "sms" }),
  signOut: () => db().auth.signOut(),
};

// ---------- Hub ----------
export async function fetchTodos(): Promise<Todo[]> {
  const { data, error } = await db().rpc("my_todos");
  if (error) throw error;
  return (data ?? []).map((r: { kind: Todo["kind"]; title: string; subtitle: string; link: string; priority: number }) => ({
    kind: r.kind, title: r.title, subtitle: r.subtitle, link: r.link, urgent: r.priority === 1,
  }));
}

export async function fetchActiveCycle() {
  const { data, error } = await db()
    .from("review_cycles")
    .select("id, code, name_th, start_date, end_date, cycle_phases(phase, start_date, end_date, sort_order)")
    .eq("status", "active").order("year", { ascending: false }).limit(1).single();
  if (error) throw error;
  return data;
}

// ---------- Goals ----------
const goalCols =
  "id, title, description, type, unit, direction, target, actual, weight, data_source, status, due_date, parent_goal_id, last_actual_at, kpi:kpi_library(code)";

type GoalRow = {
  id: string; title: string; description: string | null; type: Goal["type"]; unit: string; direction: Goal["direction"];
  target: number; actual: number | null; weight: number; data_source: Goal["source"]; status: Goal["status"];
  due_date: string; parent_goal_id: string | null; last_actual_at: string | null; kpi: { code: string } | null;
};
const toGoal = (r: GoalRow): Goal => ({
  id: r.id, title: r.title, description: r.description ?? undefined, type: r.type, unit: r.unit, direction: r.direction,
  target: Number(r.target), actual: r.actual === null ? null : Number(r.actual), weight: Number(r.weight),
  source: r.data_source, status: r.status, dueDate: r.due_date, parentId: r.parent_goal_id ?? undefined,
  kpiCode: r.kpi?.code, lastUpdated: r.last_actual_at ?? undefined,
});

export async function fetchMyGoals(cycleId: string, employeeId: string): Promise<Goal[]> {
  const { data, error } = await db().from("goals").select(goalCols)
    .eq("cycle_id", cycleId).eq("employee_id", employeeId).neq("status", "cancelled").order("weight", { ascending: false });
  if (error) throw error;
  return (data as unknown as GoalRow[]).map(toGoal);
}

export async function createGoal(cycleId: string, employeeId: string, g: Omit<Goal, "id" | "status">) {
  const { data, error } = await db().from("goals").insert({
    cycle_id: cycleId, employee_id: employeeId, created_by: employeeId, type: g.type, title: g.title,
    description: g.description, unit: g.unit, direction: g.direction, target: g.target, weight: g.weight,
    data_source: g.source, due_date: g.dueDate, parent_goal_id: g.parentId, status: "draft",
  }).select(goalCols).single();
  if (error) throw error;
  return toGoal(data as unknown as GoalRow);
}

/** ส่งเป้าหมายทั้งหมดให้หัวหน้าอนุมัติ (ตรวจน้ำหนักรวม = 100 ก่อนส่ง) */
export async function submitGoalsForApproval(cycleId: string, employeeId: string) {
  const { error } = await db().from("goals").update({ status: "pending_approval" })
    .eq("cycle_id", cycleId).eq("employee_id", employeeId).eq("status", "draft");
  if (error) throw error;
}

export async function approveGoals(goalIds: string[], approverId: string) {
  const { error } = await db().from("goals")
    .update({ status: "approved", approved_by: approverId, approved_at: new Date().toISOString() }).in("id", goalIds);
  if (error) throw error;
}

export async function addGoalUpdate(goalId: string, actual: number, note: string, employeeId: string) {
  const c = db();
  const { error } = await c.from("goal_updates").insert({ goal_id: goalId, actual, note, created_by: employeeId });
  if (error) throw error;
  await c.from("goals").update({ actual }).eq("id", goalId);
}

// ---------- Check-in ----------
export async function fetchCheckins(employeeId: string): Promise<Checkin[]> {
  const { data, error } = await db().from("checkins")
    .select("id, checkin_date, went_well, challenges, support_needed, next_steps, mood, next_checkin_date, goal_snapshot, manager:employees!checkins_manager_id_fkey(first_name_th, last_name_th)")
    .eq("employee_id", employeeId).order("checkin_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, date: r.checkin_date, withName: `${r.manager?.first_name_th ?? ""} ${r.manager?.last_name_th ?? ""}`.trim(),
    wentWell: r.went_well ?? "", challenges: r.challenges ?? "", supportNeeded: r.support_needed ?? "", nextSteps: r.next_steps ?? "",
    mood: r.mood ?? 3, progress: r.goal_snapshot?.avg_progress ?? 0, nextDate: r.next_checkin_date ?? undefined,
  }));
}

export async function createCheckin(input: {
  cycleId: string; employeeId: string; managerId: string; createdBy: string; c: Omit<Checkin, "id" | "withName">;
}) {
  const { c } = input;
  const { error } = await db().from("checkins").insert({
    cycle_id: input.cycleId, employee_id: input.employeeId, manager_id: input.managerId, created_by: input.createdBy,
    checkin_date: c.date, went_well: c.wentWell, challenges: c.challenges, support_needed: c.supportNeeded,
    next_steps: c.nextSteps, mood: c.mood, next_checkin_date: c.nextDate, goal_snapshot: { avg_progress: c.progress },
  });
  if (error) throw error;
}

// ---------- Feedback ----------
export async function fetchFeedback(employeeId: string): Promise<Feedback[]> {
  const { data, error } = await db().from("feedback")
    .select("id, from_employee_id, to_employee_id, type, message, badge, visibility, created_at, is_read, competency:competencies(name_th)")
    .or(`to_employee_id.eq.${employeeId},from_employee_id.eq.${employeeId}`)
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, fromId: r.from_employee_id, toId: r.to_employee_id, type: r.type, message: r.message, badge: r.badge ?? undefined,
    visibility: r.visibility, createdAt: r.created_at.slice(0, 10), isRead: r.is_read, competency: r.competency?.name_th,
  }));
}

export async function sendFeedback(f: Omit<Feedback, "id" | "createdAt">, competencyId?: string) {
  const { error } = await db().from("feedback").insert({
    from_employee_id: f.fromId, to_employee_id: f.toId, type: f.type, message: f.message,
    badge: f.badge, visibility: f.visibility, competency_id: competencyId,
  });
  if (error) throw error;
}

// ---------- Review ----------
export async function saveReview(planId: string, reviewerId: string, type: "self" | "manager",
  items: { goalId?: string; competencyId?: string; rating: number; comment?: string }[], comment: string, submit: boolean) {
  const c = db();
  const { data: review, error } = await c.from("reviews").upsert({
    plan_id: planId, reviewer_id: reviewerId, review_type: type, overall_comment: comment,
    status: submit ? "submitted" : "draft", submitted_at: submit ? new Date().toISOString() : null,
  }, { onConflict: "plan_id,review_type" }).select("id").single();
  if (error) throw error;
  await c.from("review_items").delete().eq("review_id", review.id);
  await c.from("review_items").insert(items.map((i) => ({
    review_id: review.id, goal_id: i.goalId, competency_id: i.competencyId, rating: i.rating, comment: i.comment,
  })));
  await c.rpc("compute_review_scores", { p_review_id: review.id });
}

// ---------- Development ----------
export const fetchCompetencyGap = (employeeId: string, positionId?: string) =>
  db().rpc("competency_gap", { p_employee: employeeId, p_position: positionId ?? null });

export const fetch360Summary = (employeeId: string, cycleId: string) =>
  db().rpc("feedback_360_summary", { p_employee: employeeId, p_cycle: cycleId });

export const fetchIdp = (employeeId: string, cycleId: string) =>
  db().from("idps").select("*, idp_actions(*, competency:competencies(name_th), course:lms_courses(course_code, title_th))")
    .eq("employee_id", employeeId).eq("cycle_id", cycleId).maybeSingle();

export const fetchCareerPath = (pathCode: string) =>
  db().from("career_paths").select("*, career_path_steps(step_order, min_tenure_months, min_rating, required_course_codes, position:positions(code, title_th, job_level))")
    .eq("code", pathCode).single();

// ---------- Manager / HR ----------
export const fetchTeam = (managerId: string) =>
  db().from("v_team_overview").select("*").eq("manager_id", managerId);

export const fetchCalibration = (sessionId: string) =>
  db().from("calibration_entries")
    .select("*, plan:performance_plans(overall_score, employee:employees(employee_code, first_name_th, last_name_th, position:positions(title_th)))")
    .eq("session_id", sessionId);

export const updateCalibration = (entryId: string, patch: { performance_level?: number; potential_level?: number; calibrated_rating?: number; rationale?: string }) =>
  db().from("calibration_entries").update(patch).eq("id", entryId);

export const fetchAnalytics = (cycleId: string) =>
  Promise.all([
    db().rpc("analytics_cycle_overview", { p_cycle: cycleId }),
    db().rpc("analytics_competency_gaps", {}),
  ]);

export async function fetchIntegrationStatus(): Promise<Partial<IntegrationSource>[]> {
  const { data, error } = await db().rpc("integration_status");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    code: r.code, name: r.name_th, direction: r.direction, records24h: Number(r.events_24h),
    failed24h: Number(r.failed_24h), pending: Number(r.outbox_pending),
    status: r.failed_24h > 0 ? "error" : r.outbox_pending > 0 ? "warning" : "ok",
  }));
}
