// =====================================================================
// ข้อมูลจริงจากฐานข้อมูล (schema pm) — โหมด "HR บันทึกแทนพนักงาน"
// ใช้เมื่อเปิดในระบบ HR รวมศูนย์ (hosted) และ schema pm เปิดให้ Data API แล้ว
// รายชื่อพนักงาน/แผนก/ตำแหน่ง/หัวหน้างาน ซิงก์มาจากระบบ HR อัตโนมัติ (pm.apply_hr_db)
// สิทธิ์: บัญชี HR ของระบบหลัก = hr_admin (pm.hr_account) — ดู supabase/migrations/…0800, …0900
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Checkin, Competency, DataSource, Direction, Feedback, Goal, IdpAction, Person, Role, TeamMember } from "./types";

export type LiveStatus = "demo" | "checking" | "ready" | "not_exposed" | "error";

export interface LiveEmployee extends Person {
  managerId: string | null;
  /** รหัสบริษัท (CMN/CIL) จากรหัสแผนก "บริษัท-แผนก" ที่ซิงก์จากระบบ HR */
  company: string;
  /** ตำแหน่ง (pm.positions) — code = Job Code ของระบบ HR ใช้ดึง KPI/Competency ของตำแหน่ง */
  positionId: string | null;
  positionCode: string;
}

/** KPI ของตำแหน่ง (จากแอปหลัก: JD/KPI/Competency → pm.position_kpis) */
export interface PosKpi {
  code: string; name: string; unit: string; direction: Direction; source: DataSource; family: string;
  weight: number | null; target?: string; formula?: string; frequency?: string; ratings: string[];
}

export interface LiveCycle { id: string; name: string; endDate: string }

export interface LiveReview {
  id: string;
  status: "not_started" | "draft" | "submitted" | "released" | "acknowledged";
  strengths: string;
  improvements: string;
  overallScore: number | null;
  goalRatings: Record<string, number>;
  competencyRatings: Record<string, number>; // key = competency code
}

function db() {
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูล");
  return supabase;
}

const COLORS = ["#2a78d6", "#6250d6", "#008300", "#eb6834", "#e87ba4", "#1baf7a", "#eda100", "#e34948"];

/** ตรวจว่าเรียก schema pm ได้ไหม (ต้องเพิ่ม pm ใน Data API › Exposed schemas) */
export async function probe(): Promise<{ status: LiveStatus; message?: string }> {
  const { error } = await db().from("review_cycles").select("id").limit(1);
  if (!error) return { status: "ready" };
  if (error.code === "PGRST106" || /schema/i.test(error.message)) return { status: "not_exposed", message: error.message };
  return { status: "error", message: error.message };
}

export async function loadEmployees(): Promise<LiveEmployee[]> {
  const { data, error } = await db().from("employees")
    .select("id, employee_code, first_name_th, last_name_th, nickname, manager_id, status, org_unit:org_units!employees_org_unit_id_fkey(code, name_th), position:positions!employees_position_id_fkey(id, code, title_th)")
    .neq("status", "terminated").order("employee_code");
  if (error) throw error;
  return (data ?? []).map((r: any, i: number) => ({
    id: r.id, code: r.employee_code, name: `${r.first_name_th} ${r.last_name_th === "-" ? "" : r.last_name_th}`.trim(),
    nickname: r.nickname ?? undefined, position: r.position?.title_th ?? "", orgUnit: r.org_unit?.name_th ?? "",
    bu: "hq", color: COLORS[i % COLORS.length], managerId: r.manager_id,
    company: String(r.org_unit?.code ?? "").split("-")[0],
    positionId: r.position?.id ?? null, positionCode: r.position?.code ?? "",
  }));
}

export async function loadCycle(): Promise<LiveCycle | null> {
  const { data, error } = await db().from("review_cycles").select("id, name_th, end_date, status, year")
    .order("year", { ascending: false });
  if (error) throw error;
  const c = (data ?? []).find((x: any) => x.status === "active") ?? (data ?? [])[0];
  return c ? { id: c.id, name: c.name_th, endDate: c.end_date } : null;
}

/** แผนประเมินของพนักงานในรอบนี้ (สร้างให้ถ้ายังไม่มี) */
export async function ensurePlan(cycleId: string, emp: LiveEmployee): Promise<string> {
  const c = db();
  const found = await c.from("performance_plans").select("id").eq("cycle_id", cycleId).eq("employee_id", emp.id).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data.id;
  const ins = await c.from("performance_plans").insert({ cycle_id: cycleId, employee_id: emp.id, manager_id: emp.managerId })
    .select("id").single();
  if (ins.error) throw ins.error;
  return ins.data.id;
}

// ---------- Goals ----------
const goalCols = "id, title, description, type, unit, direction, target, actual, weight, data_source, status, due_date, parent_goal_id, last_actual_at, kpi:kpi_library(code)";
const toGoal = (r: any): Goal => ({
  id: r.id, title: r.title, description: r.description ?? undefined, type: r.type, unit: r.unit ?? "", direction: r.direction,
  target: Number(r.target ?? 0), actual: r.actual === null ? null : Number(r.actual), weight: Number(r.weight),
  source: r.data_source, status: r.status, dueDate: r.due_date ?? "", parentId: r.parent_goal_id ?? undefined,
  kpiCode: r.kpi?.code, lastUpdated: r.last_actual_at ? new Date(r.last_actual_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : undefined,
});

export async function loadGoals(cycleId: string, empId: string): Promise<Goal[]> {
  const { data, error } = await db().from("goals").select(goalCols)
    .eq("cycle_id", cycleId).eq("employee_id", empId).neq("status", "cancelled")
    .order("weight", { ascending: false }).order("created_at");
  if (error) throw error;
  return (data ?? []).map(toGoal);
}

export async function createGoal(cycleId: string, planId: string, empId: string, g: Omit<Goal, "id" | "status">, dueDate: string) {
  const c = db();
  let kpiId: string | null = null;
  if (g.kpiCode) {
    const k = await c.from("kpi_library").select("id").eq("code", g.kpiCode).maybeSingle();
    kpiId = k.data?.id ?? null;
  }
  const { error } = await c.from("goals").insert({
    plan_id: planId, cycle_id: cycleId, employee_id: empId, type: g.type, title: g.title, description: g.description ?? null,
    kpi_id: kpiId, unit: g.unit, direction: g.direction, target: g.target, actual: g.actual, weight: g.weight,
    data_source: g.source, due_date: g.dueDate || dueDate, status: "draft",
  });
  if (error) throw error;
}

export async function updateGoalActual(goalId: string, actual: number, note: string) {
  const c = db();
  const u = await c.from("goal_updates").insert({ goal_id: goalId, actual, note: note || null });
  if (u.error) throw u.error;
  const { error } = await c.from("goals").update({ actual, last_actual_at: new Date().toISOString() }).eq("id", goalId);
  if (error) throw error;
}

export async function deleteGoal(goalId: string) {
  const { error } = await db().from("goals").delete().eq("id", goalId);
  if (error) throw error;
}

export async function setGoalsStatus(cycleId: string, empId: string, from: Goal["status"], to: Goal["status"]) {
  const patch: Record<string, unknown> = { status: to };
  if (to === "approved") patch.approved_at = new Date().toISOString();
  const { error } = await db().from("goals").update(patch).eq("cycle_id", cycleId).eq("employee_id", empId).eq("status", from);
  if (error) throw error;
}

// ---------- Check-in ----------
export async function loadCheckins(empId: string): Promise<Checkin[]> {
  const { data, error } = await db().from("checkins")
    .select("id, checkin_date, went_well, challenges, support_needed, next_steps, mood, next_checkin_date, goal_snapshot, manager:employees!checkins_manager_id_fkey(first_name_th, last_name_th)")
    .eq("employee_id", empId).order("checkin_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, date: r.checkin_date, withName: `${r.manager?.first_name_th ?? ""} ${r.manager?.last_name_th === "-" ? "" : r.manager?.last_name_th ?? ""}`.trim(),
    wentWell: r.went_well ?? "", challenges: r.challenges ?? "", supportNeeded: r.support_needed ?? "", nextSteps: r.next_steps ?? "",
    mood: r.mood ?? 3, progress: r.goal_snapshot?.avg_progress ?? 0, nextDate: r.next_checkin_date ?? undefined,
  }));
}

export async function createCheckin(cycleId: string, emp: LiveEmployee, c: Omit<Checkin, "id" | "withName">) {
  if (!emp.managerId) throw new Error("พนักงานคนนี้ยังไม่มีหัวหน้างานในระบบ HR — กำหนดหัวหน้างานที่ฐานข้อมูลพนักงานก่อน");
  const { error } = await db().from("checkins").insert({
    cycle_id: cycleId, employee_id: emp.id, manager_id: emp.managerId, checkin_date: c.date,
    went_well: c.wentWell, challenges: c.challenges, support_needed: c.supportNeeded, next_steps: c.nextSteps,
    mood: c.mood, next_checkin_date: c.nextDate || null, goal_snapshot: { avg_progress: c.progress },
  });
  if (error) throw error;
}

// ---------- Review ----------
export async function loadReview(planId: string, type: "self" | "manager"): Promise<LiveReview | null> {
  const c = db();
  const { data, error } = await c.from("reviews")
    .select("id, status, strengths, improvements, overall_score, review_items(goal_id, rating, competency:competencies(code))")
    .eq("plan_id", planId).eq("review_type", type).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const goalRatings: Record<string, number> = {}, competencyRatings: Record<string, number> = {};
  for (const it of (data as any).review_items ?? []) {
    if (it.goal_id && it.rating) goalRatings[it.goal_id] = it.rating;
    if (it.competency?.code && it.rating) competencyRatings[it.competency.code] = it.rating;
  }
  return {
    id: data.id, status: data.status, strengths: data.strengths ?? "", improvements: data.improvements ?? "",
    overallScore: data.overall_score === null ? null : Number(data.overall_score), goalRatings, competencyRatings,
  };
}

export async function saveReview(input: {
  planId: string; reviewerId: string; type: "self" | "manager"; submit: boolean; strengths: string; improvements: string;
  goalRatings: Record<string, number>; competencyRatings: Record<string, number>; proposedRating: number | null;
}) {
  const c = db();
  const comps = await c.from("competencies").select("id, code");
  if (comps.error) throw comps.error;
  const compId = Object.fromEntries((comps.data ?? []).map((x: any) => [x.code, x.id]));
  const { data: review, error } = await c.from("reviews").upsert({
    plan_id: input.planId, reviewer_id: input.reviewerId, review_type: input.type,
    strengths: input.strengths || null, improvements: input.improvements || null, proposed_rating: input.proposedRating,
    status: input.submit ? "submitted" : "draft", submitted_at: input.submit ? new Date().toISOString() : null,
  }, { onConflict: "plan_id,review_type" }).select("id").single();
  if (error) throw error;
  const del = await c.from("review_items").delete().eq("review_id", review.id);
  if (del.error) throw del.error;
  const items = [
    ...Object.entries(input.goalRatings).map(([goal_id, rating]) => ({ review_id: review.id, goal_id, rating })),
    ...Object.entries(input.competencyRatings).filter(([code]) => compId[code]).map(([code, rating]) => ({ review_id: review.id, competency_id: compId[code], rating })),
  ];
  if (items.length) {
    const ins = await c.from("review_items").insert(items);
    if (ins.error) throw ins.error;
  }
  const r = await c.rpc("compute_review_scores", { p_review_id: review.id });
  if (r.error) throw r.error;
}

/** แผนประเมินที่มีอยู่แล้ว (ไม่สร้างใหม่) — ใช้ตอนเปิดดูแบบประเมิน */
export async function findPlan(cycleId: string, empId: string): Promise<string | null> {
  const { data, error } = await db().from("performance_plans").select("id").eq("cycle_id", cycleId).eq("employee_id", empId).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// ---------- KPI / Competency ของตำแหน่ง (ซิงก์จากแอปหลัก) ----------
const CAT: Record<string, Competency["category"]> = { core: "core", leadership: "leadership", functional: "functional" };
export async function loadFramework(positionId: string): Promise<{ kpis: PosKpi[]; comps: Competency[] }> {
  const c = db();
  const [k, p] = await Promise.all([
    c.from("position_kpis").select("weight, target_text, formula, frequency, rating_desc, kpi:kpi_library(code, name_th, unit, direction, data_source, is_active)").eq("position_id", positionId),
    c.from("position_competencies").select("required_level, weight, competency:competencies(id, code, name_th, category, is_active)").eq("position_id", positionId),
  ]);
  if (k.error) throw k.error;
  if (p.error) throw p.error;
  const kpis = (k.data ?? []).filter((r: any) => r.kpi && r.kpi.is_active !== false).map((r: any): PosKpi => ({
    code: r.kpi.code, name: r.kpi.name_th, unit: r.kpi.unit === "-" ? "" : r.kpi.unit, direction: r.kpi.direction, source: r.kpi.data_source,
    family: "KPI ตามตำแหน่ง", weight: r.weight === null ? null : Number(r.weight), target: r.target_text ?? undefined,
    formula: r.formula ?? undefined, frequency: r.frequency ?? undefined, ratings: (r.rating_desc ?? []).map((x: unknown) => String(x ?? "")),
  })).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || a.code.localeCompare(b.code));
  const comps = (p.data ?? []).filter((r: any) => r.competency && r.competency.is_active !== false).map((r: any): Competency => ({
    id: r.competency.id, code: r.competency.code, name: r.competency.name_th, category: CAT[r.competency.category] ?? "functional",
    required: r.required_level, current: 0,
  })).sort((a, b) => a.code.localeCompare(b.code));
  return { kpis, comps };
}

/** พจนานุกรม Competency จากแอปหลัก (pm.competencies source = hr) พร้อมคำอธิบายระดับ 1–5 */
export interface DictCompetency { id: string; code: string; name: string; nameEn: string; category: Competency["category"]; description: string; levels: string[] }
export async function loadCompetencyDictionary(): Promise<DictCompetency[]> {
  const { data, error } = await db().from("competencies").select("id, code, name_th, name_en, category, description, levels")
    .eq("source", "hr").eq("is_active", true).order("code");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, code: r.code, name: r.name_th, nameEn: r.name_en ?? "", category: CAT[r.category] ?? "functional",
    description: r.description ?? "", levels: (r.levels ?? []).map((x: unknown) => String(x ?? "")) }));
}

// =====================================================================
// ผู้ใช้ที่ล็อกอินจริง + ข้อมูลกลางสำหรับหน้าอื่น ๆ (ทีม, Feedback, IDP, 360, Calibration, Analytics, Career)
// =====================================================================
export interface Account { userId: string; email: string; name: string; employeeId: string | null; employeeCode: string | null; role: Role }

/** บัญชีที่ล็อกอิน (pm.whoami) — ถ้ายังไม่มีฟังก์ชันในฐานข้อมูล ใช้อีเมลจาก session และถือเป็นบัญชี HR (เฉพาะบัญชี HR ที่เปิด schema pm ได้) */
export async function whoami(): Promise<Account | null> {
  const c = db();
  const r = await c.rpc("whoami");
  if (!r.error && r.data) {
    const d = r.data as any;
    return { userId: d.user_id, email: d.email ?? "", name: d.name ?? d.email ?? "", employeeId: d.employee_id ?? null, employeeCode: d.employee_code ?? null, role: d.role as Role };
  }
  const s = await c.auth.getSession();
  const u = s.data.session?.user;
  if (!u) return null;
  return { userId: u.id, email: u.email ?? "", name: (u.user_metadata as any)?.name ?? (u.email ?? "").split("@")[0], employeeId: null, employeeCode: null, role: "hr" };
}

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
const nameOf = (e: any) => (e ? `${e.first_name_th ?? ""} ${e.last_name_th === "-" ? "" : e.last_name_th ?? ""}`.trim() : "");

/** สถานะทีม: แผนประเมิน, เป้าหมาย, Check-in ล่าสุด, คะแนนประเมิน ของพนักงานแต่ละคนในรอบนี้ */
export async function loadTeamStatus(cycleId: string, members: LiveEmployee[]): Promise<TeamMember[]> {
  if (!members.length) return [];
  const ids = members.map((m) => m.id);
  const c = db();
  const [plans, goals, cks] = await Promise.all([
    c.from("performance_plans").select("id, employee_id, status, reviews(review_type, status, overall_score)").eq("cycle_id", cycleId).in("employee_id", ids),
    c.from("goals").select("employee_id, target, actual, direction, status").eq("cycle_id", cycleId).in("employee_id", ids).neq("status", "cancelled"),
    c.from("checkins").select("employee_id, checkin_date").in("employee_id", ids).order("checkin_date", { ascending: false }),
  ]);
  for (const r of [plans, goals, cks]) if (r.error) throw r.error;
  return members.map((m) => {
    const plan: any = (plans.data ?? []).find((p: any) => p.employee_id === m.id);
    const gs = (goals.data ?? []).filter((g: any) => g.employee_id === m.id);
    const prog = gs.map((g: any) => {
      const t = Number(g.target), a = g.actual === null ? null : Number(g.actual);
      if (a === null || !t) return 0;
      return g.direction === "lower_better" ? Math.min(150, (t / Math.max(a, 0.0001)) * 100) : Math.min(150, (a / t) * 100);
    });
    const progress = prog.length ? Math.round(prog.reduce((s, x) => s + x, 0) / prog.length) : 0;
    const health: TeamMember["health"] = !gs.length ? "no_goal" : progress >= 90 ? "on_track" : progress >= 70 ? "at_risk" : "off_track";
    const rv = (t: string) => (plan?.reviews ?? []).find((x: any) => x.review_type === t);
    const self = rv("self"), mgr = rv("manager");
    const pending = gs.some((g: any) => g.status === "pending_approval");
    const planStatus: TeamMember["planStatus"] = plan?.status === "released" || plan?.status === "acknowledged" ? "released"
      : self?.status === "submitted" && !(mgr && mgr.status === "submitted") ? "manager_review"
      : pending || !gs.length ? "goal_pending" : gs.every((g: any) => g.status !== "draft") && !self ? "goal_approved" : "self_review";
    return { ...m, planStatus, goals: gs.length, progress, health,
      lastCheckin: (cks.data ?? []).find((x: any) => x.employee_id === m.id)?.checkin_date ?? null,
      selfScore: self?.overall_score == null ? null : Number(self.overall_score), managerScore: mgr?.overall_score == null ? null : Number(mgr.overall_score) };
  });
}

// ---------- Feedback ----------
export async function loadFeedback(empId: string): Promise<Feedback[]> {
  const { data, error } = await db().from("feedback")
    .select("id, from_employee_id, to_employee_id, type, message, badge, visibility, created_at, is_read, competency:competencies(name_th)")
    .or(`to_employee_id.eq.${empId},from_employee_id.eq.${empId}`).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, fromId: r.from_employee_id, toId: r.to_employee_id, type: r.type, message: r.message,
    badge: r.badge ?? undefined, visibility: r.visibility, createdAt: String(r.created_at).slice(0, 10), isRead: r.is_read, competency: one<any>(r.competency)?.name_th }));
}
export async function createFeedback(f: Omit<Feedback, "id" | "createdAt">, competencyId?: string) {
  const { error } = await db().from("feedback").insert({ from_employee_id: f.fromId, to_employee_id: f.toId, type: f.type, message: f.message,
    badge: f.badge ?? null, visibility: f.visibility, competency_id: competencyId ?? null });
  if (error) throw error;
}
export async function markFeedbackRead(empId: string) {
  const { error } = await db().from("feedback").update({ is_read: true }).eq("to_employee_id", empId).eq("is_read", false);
  if (error) throw error;
}

// ---------- IDP ----------
export async function loadIdp(empId: string, cycleId: string): Promise<{ idpId: string | null; aspiration: string; actions: IdpAction[] }> {
  const { data, error } = await db().from("idps")
    .select("id, career_aspiration, idp_actions(id, title, action_type, due_date, status, progress_pct, outcome_note, competency:competencies(name_th), mentor:employees!idp_actions_mentor_id_fkey(first_name_th, last_name_th))")
    .eq("employee_id", empId).eq("cycle_id", cycleId).maybeSingle();
  if (error) throw error;
  if (!data) return { idpId: null, aspiration: "", actions: [] };
  return { idpId: data.id, aspiration: (data as any).career_aspiration ?? "", actions: ((data as any).idp_actions ?? []).map((a: any): IdpAction => ({
    id: a.id, title: a.title, type: a.action_type, competency: one<any>(a.competency)?.name_th ?? "", dueDate: a.due_date ?? "", status: a.status === "cancelled" ? "not_started" : a.status,
    progress: a.progress_pct ?? 0, mentor: nameOf(one(a.mentor)) || undefined, note: a.outcome_note ?? undefined })) };
}
export async function ensureIdp(empId: string, cycleId: string): Promise<string> {
  const c = db();
  const f = await c.from("idps").select("id").eq("employee_id", empId).eq("cycle_id", cycleId).maybeSingle();
  if (f.error) throw f.error;
  if (f.data) return f.data.id;
  const ins = await c.from("idps").insert({ employee_id: empId, cycle_id: cycleId }).select("id").single();
  if (ins.error) throw ins.error;
  return ins.data.id;
}
export async function addIdpAction(idpId: string, a: Omit<IdpAction, "id">, competencyId?: string) {
  const { error } = await db().from("idp_actions").insert({ idp_id: idpId, title: a.title, action_type: a.type, competency_id: competencyId ?? null,
    due_date: a.dueDate || null, status: a.status, progress_pct: a.progress, outcome_note: a.note ?? null });
  if (error) throw error;
}
export async function updateIdpAction(id: string, patch: Partial<IdpAction>) {
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.progress != null) row.progress_pct = patch.progress;
  if (patch.note != null) row.outcome_note = patch.note;
  const { error } = await db().from("idp_actions").update(row).eq("id", id);
  if (error) throw error;
}

// ---------- 360 ----------
export interface Live360 { raters: { relation: string; status: string; name: string }[]; byCompetency: { name: string; self: number | null; others: number | null }[] }
export async function load360(empId: string, cycleId: string): Promise<Live360> {
  const { data, error } = await db().from("feedback_360_requests")
    .select("relation, status, rater:employees!feedback_360_requests_rater_employee_id_fkey(first_name_th, last_name_th), feedback_360_responses(rating, competency:competencies(name_th))")
    .eq("subject_employee_id", empId).eq("cycle_id", cycleId);
  if (error) throw error;
  const acc: Record<string, { s: number[]; o: number[] }> = {};
  for (const r of (data ?? []) as any[]) for (const x of r.feedback_360_responses ?? []) {
    const n = one<any>(x.competency)?.name_th; if (!n || !x.rating) continue;
    (acc[n] ??= { s: [], o: [] })[r.relation === "self" ? "s" : "o"].push(Number(x.rating));
  }
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return { raters: ((data ?? []) as any[]).map((r) => ({ relation: r.relation, status: r.status, name: nameOf(one(r.rater)) })),
    byCompetency: Object.entries(acc).map(([name, v]) => ({ name, self: avg(v.s), others: avg(v.o) })) };
}

// ---------- Calibration / Analytics ----------
export interface LivePlanRow { planId: string; employeeId: string; name: string; code: string; position: string; orgUnit: string; company: string;
  status: string; overall: number | null; finalRating: number | null; calibrated: number | null; potential: number | null }
export async function loadPlans(cycleId: string): Promise<LivePlanRow[]> {
  const { data, error } = await db().from("performance_plans")
    .select("id, employee_id, status, overall_score, final_rating, calibrated_rating, potential_rating, employee:employees!performance_plans_employee_id_fkey(employee_code, first_name_th, last_name_th, org_unit:org_units!employees_org_unit_id_fkey(code, name_th), position:positions!employees_position_id_fkey(title_th))")
    .eq("cycle_id", cycleId);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => { const e = one<any>(r.employee) ?? {}; const ou = one<any>(e.org_unit) ?? {};
    return { planId: r.id, employeeId: r.employee_id, name: nameOf(e), code: e.employee_code ?? "", position: one<any>(e.position)?.title_th ?? "", orgUnit: ou.name_th ?? "",
      company: String(ou.code ?? "").split("-")[0], status: r.status, overall: r.overall_score == null ? null : Number(r.overall_score),
      finalRating: r.final_rating, calibrated: r.calibrated_rating, potential: r.potential_rating }; });
}
export async function saveCalibration(planId: string, patch: { calibrated_rating?: number; potential_rating?: number }) {
  const { error } = await db().from("performance_plans").update(patch).eq("id", planId);
  if (error) throw error;
}

// ---------- หลักสูตรจากแอปฝึกอบรม (public.hrd_*) ----------
export interface LiveCourse { id: string; code: string; title: string; category: string; hours: number; format: string; nextDate: string | null }
export async function loadTrainingCourses(): Promise<LiveCourse[]> {
  const { data, error } = await db().schema("public").from("hrd_courses")
    .select("id, code, title, category, hours, format, status, sessions:hrd_training_sessions(start_date, status)").eq("status", "published").order("title");
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as any[]).map((c) => ({ id: c.id, code: c.code, title: c.title, category: c.category ?? "", hours: Number(c.hours ?? 0), format: c.format ?? "",
    nextDate: (c.sessions ?? []).map((s: any) => s.start_date).filter((d: string) => d >= today).sort()[0] ?? null }));
}
/** ประวัติอบรมของพนักงาน (แอปฝึกอบรม) — ผูกด้วยรหัสพนักงาน */
export async function loadTrainingHistory(empCode: string): Promise<{ title: string; date: string; status: string }[]> {
  const { data, error } = await db().schema("public").from("hrd_employees")
    .select("enrollments:hrd_enrollments!hrd_enrollments_employee_id_fkey(status, session:hrd_training_sessions(start_date, course:hrd_courses(title)))")
    .eq("employee_code", empCode).maybeSingle();
  if (error) throw error;
  return (((data as any)?.enrollments ?? []) as any[]).map((e) => { const s = one<any>(e.session) ?? {};
    return { title: one<any>(s.course)?.title ?? "", date: s.start_date ?? "", status: e.status }; }).sort((a, b) => b.date.localeCompare(a.date));
}

export interface LivePhase { phase: string; start: string; end: string }
export async function loadCyclePhases(cycleId: string): Promise<LivePhase[]> {
  const { data, error } = await db().from("cycle_phases").select("phase, start_date, end_date, sort_order").eq("cycle_id", cycleId).order("sort_order");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ phase: r.phase, start: r.start_date, end: r.end_date }));
}

/** Recognition Wall: คำชื่นชมแบบสาธารณะล่าสุด */
export async function loadPublicFeedback(): Promise<Feedback[]> {
  const { data, error } = await db().from("feedback")
    .select("id, from_employee_id, to_employee_id, type, message, badge, visibility, created_at, is_read, competency:competencies(name_th)")
    .eq("visibility", "public").order("created_at", { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, fromId: r.from_employee_id, toId: r.to_employee_id, type: r.type, message: r.message,
    badge: r.badge ?? undefined, visibility: r.visibility, createdAt: String(r.created_at).slice(0, 10), isRead: r.is_read, competency: one<any>(r.competency)?.name_th }));
}

// ---------- 360° (ข้อมูลจริง) ----------
export type Relation360 = "self" | "manager" | "peer" | "direct_report" | "internal_customer";
export interface Request360 { id: string; subjectId: string; raterId: string; relation: Relation360; status: string; dueDate: string | null }
export interface Result360 { axes: string[]; series: { key: Relation360; label: string; values: (number | null)[]; n: number }[]; comments: string[]; raters: Request360[] }
const REL_LABEL: Record<Relation360, string> = { self: "ตนเอง", manager: "หัวหน้า", peer: "เพื่อนร่วมงาน", direct_report: "ลูกทีม", internal_customer: "ลูกค้าภายใน" };
export const rel360Label = (r: string) => REL_LABEL[r as Relation360] ?? r;

export async function load360Result(empId: string, cycleId: string): Promise<Result360> {
  const { data, error } = await db().from("feedback_360_requests")
    .select("id, subject_employee_id, rater_employee_id, relation, status, due_date, feedback_360_responses(rating, comment, competency:competencies(name_th))")
    .eq("subject_employee_id", empId).eq("cycle_id", cycleId);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const axes: string[] = []; const acc: Record<string, Record<string, number[]>> = {}; const done: Record<string, Set<string>> = {}; const comments: string[] = [];
  for (const r of rows) for (const x of r.feedback_360_responses ?? []) {
    const n = one<any>(x.competency)?.name_th;
    if (x.comment) comments.push(x.comment);
    if (!n || !x.rating) continue;
    if (!axes.includes(n)) axes.push(n);
    ((acc[r.relation] ??= {})[n] ??= []).push(Number(x.rating));
    (done[r.relation] ??= new Set()).add(r.id);
  }
  const order: Relation360[] = ["self", "manager", "peer", "direct_report", "internal_customer"];
  const series = order.filter((k) => acc[k]).map((k) => ({ key: k, label: REL_LABEL[k], n: done[k]?.size ?? 0,
    values: axes.map((a) => { const v = acc[k][a]; return v && v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }) }));
  return { axes, series, comments: [...new Set(comments)], raters: rows.map((r) => ({ id: r.id, subjectId: r.subject_employee_id, raterId: r.rater_employee_id, relation: r.relation, status: r.status, dueDate: r.due_date })) };
}
/** คำขอให้ "พนักงานคนนี้" ไปประเมินคนอื่น */
export async function load360ToRate(raterId: string, cycleId: string): Promise<Request360[]> {
  const { data, error } = await db().from("feedback_360_requests").select("id, subject_employee_id, rater_employee_id, relation, status, due_date")
    .eq("rater_employee_id", raterId).eq("cycle_id", cycleId).order("due_date");
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, subjectId: r.subject_employee_id, raterId: r.rater_employee_id, relation: r.relation, status: r.status, dueDate: r.due_date }));
}
export async function submit360(requestId: string, ratings: Record<string, number>, comment: string) {
  const c = db();
  const del = await c.from("feedback_360_responses").delete().eq("request_id", requestId);
  if (del.error) throw del.error;
  const rows = Object.entries(ratings).map(([competency_id, rating], i) => ({ request_id: requestId, competency_id, rating, comment: i === 0 && comment ? comment : null }));
  if (rows.length) { const ins = await c.from("feedback_360_responses").insert(rows); if (ins.error) throw ins.error; }
  const up = await c.from("feedback_360_requests").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", requestId);
  if (up.error) throw up.error;
}
/** เลือกผู้ประเมิน: สร้างคำขอ (ตนเอง + หัวหน้า + คนที่เลือก) — ไม่ซ้ำคนเดิม */
export async function nominate360(subjectId: string, cycleId: string, managerId: string | null, raterIds: string[], dueDate: string) {
  const c = db();
  const ex = await c.from("feedback_360_requests").select("rater_employee_id").eq("subject_employee_id", subjectId).eq("cycle_id", cycleId);
  if (ex.error) throw ex.error;
  const have = new Set((ex.data ?? []).map((r: any) => r.rater_employee_id));
  const want: { rater: string; relation: Relation360 }[] = [{ rater: subjectId, relation: "self" }];
  if (managerId) want.push({ rater: managerId, relation: "manager" });
  raterIds.forEach((r) => want.push({ rater: r, relation: "peer" }));
  const rows = want.filter((w) => !have.has(w.rater)).map((w) => ({ cycle_id: cycleId, subject_employee_id: subjectId, rater_employee_id: w.rater, relation: w.relation, status: "pending", due_date: dueDate }));
  if (rows.length) { const ins = await c.from("feedback_360_requests").insert(rows); if (ins.error) throw ins.error; }
  return rows.length;
}

// ---------- Analytics: ตัวชี้วัดทั้งองค์กรในรอบนี้ ----------
export interface OrgStats { withGoals: Set<string>; checkinDates: Record<string, string[]>; withIdp: Set<string>; selfDone: Set<string> }
export async function loadOrgStats(cycleId: string): Promise<OrgStats> {
  const c = db();
  const [g, ck, idp, rv] = await Promise.all([
    c.from("goals").select("employee_id").eq("cycle_id", cycleId).neq("status", "cancelled"),
    c.from("checkins").select("employee_id, checkin_date").gte("checkin_date", new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10)),
    c.from("idps").select("employee_id").eq("cycle_id", cycleId),
    c.from("reviews").select("review_type, status, plan:performance_plans!inner(employee_id, cycle_id)").eq("review_type", "self").eq("plan.cycle_id", cycleId),
  ]);
  for (const r of [g, ck, idp, rv]) if (r.error) throw r.error;
  const checkinDates: Record<string, string[]> = {};
  for (const r of (ck.data ?? []) as any[]) (checkinDates[r.employee_id] ??= []).push(r.checkin_date);
  return {
    withGoals: new Set((g.data ?? []).map((r: any) => r.employee_id)),
    checkinDates,
    withIdp: new Set((idp.data ?? []).map((r: any) => r.employee_id)),
    selfDone: new Set(((rv.data ?? []) as any[]).filter((r) => ["submitted", "released", "acknowledged"].includes(r.status)).map((r) => one<any>(r.plan)?.employee_id)),
  };
}

// ---------- เส้นทางอาชีพ (JD ในแอปหลัก) + ตำแหน่งว่างภายใน (ใบขออัตรากำลัง) ----------
export interface LiveCareer { next: string; criteria: string; timeline: string }
export async function loadCareer(positionId: string): Promise<LiveCareer | null> {
  const { data, error } = await db().from("positions").select("career_next, career_criteria, career_timeline").eq("id", positionId).maybeSingle();
  if (error) { if (/career_/.test(error.message)) return null; throw error; }   // ยังไม่ได้ซิงก์คอลัมน์
  return data ? { next: (data as any).career_next ?? "", criteria: (data as any).career_criteria ?? "", timeline: (data as any).career_timeline ?? "" } : null;
}
export interface LiveJob { id: string; title: string; unit: string; close: string | null; positionId: string | null }
export async function loadInternalJobs(): Promise<LiveJob[]> {
  const { data, error } = await db().from("internal_jobs").select("id, title_th, close_date, position_id, org_unit:org_units(name_th)").eq("status", "open").order("close_date");
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, title: r.title_th, unit: one<any>(r.org_unit)?.name_th ?? "", close: r.close_date, positionId: r.position_id }));
}
/** ระดับ Competency ล่าสุดจากแบบประเมิน (หัวหน้า ถ้าไม่มีใช้ประเมินตนเอง) — key = รหัส Competency */
export async function loadCompetencyLevels(cycleId: string, empId: string): Promise<Record<string, number>> {
  const planId = await findPlan(cycleId, empId);
  if (!planId) return {};
  const [m, s] = await Promise.all([loadReview(planId, "manager"), loadReview(planId, "self")]);
  return { ...(s?.competencyRatings ?? {}), ...(m?.competencyRatings ?? {}) };
}

// ---------- เป้าหมายองค์กร / ทีม (Cascade) ----------
export async function loadOrgGoals(cycleId: string): Promise<(Goal & { level: string })[]> {
  const { data, error } = await db().from("goals").select(goalCols + ", org_unit:org_units(name_th)").eq("cycle_id", cycleId).in("type", ["company", "team"]).neq("status", "cancelled").order("type");
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({ ...toGoal(r), level: r.type === "company" ? "บริษัท" : one<any>(r.org_unit)?.name_th ?? "ทีม" }));
}

// ---------- ตั้งค่ารอบประเมิน ----------
export interface CycleInfo { id: string; name: string; year: number; start: string; end: string; status: string }
export async function loadCycleInfo(cycleId: string): Promise<CycleInfo | null> {
  const { data, error } = await db().from("review_cycles").select("id, name_th, year, start_date, end_date, status").eq("id", cycleId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, name: (data as any).name_th, year: (data as any).year, start: (data as any).start_date, end: (data as any).end_date, status: (data as any).status } : null;
}
export async function saveCycle(c: CycleInfo, phases: LivePhase[]) {
  const db_ = db();
  const u = await db_.from("review_cycles").update({ name_th: c.name, year: c.year, start_date: c.start, end_date: c.end }).eq("id", c.id);
  if (u.error) throw u.error;
  const d = await db_.from("cycle_phases").delete().eq("cycle_id", c.id);
  if (d.error) throw d.error;
  const rows = phases.filter((p) => p.start && p.end).map((p, i) => ({ cycle_id: c.id, phase: p.phase, start_date: p.start, end_date: p.end, sort_order: i + 1 }));
  if (rows.length) { const ins = await db_.from("cycle_phases").insert(rows); if (ins.error) throw ins.error; }
}
