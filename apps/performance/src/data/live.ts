// =====================================================================
// ข้อมูลจริงจากฐานข้อมูล (schema pm) — โหมด "HR บันทึกแทนพนักงาน"
// ใช้เมื่อเปิดในระบบ HR รวมศูนย์ (hosted) และ schema pm เปิดให้ Data API แล้ว
// รายชื่อพนักงาน/แผนก/ตำแหน่ง/หัวหน้างาน ซิงก์มาจากระบบ HR อัตโนมัติ (pm.apply_hr_db)
// สิทธิ์: บัญชี HR ของระบบหลัก = hr_admin (pm.hr_account) — ดู supabase/migrations/…0800, …0900
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Checkin, Goal, Person } from "./types";

export type LiveStatus = "demo" | "checking" | "ready" | "not_exposed" | "error";

export interface LiveEmployee extends Person {
  managerId: string | null;
  /** รหัสบริษัท (CMN/CIL) จากรหัสแผนก "บริษัท-แผนก" ที่ซิงก์จากระบบ HR */
  company: string;
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
    .select("id, employee_code, first_name_th, last_name_th, nickname, manager_id, status, org_unit:org_units(code, name_th), position:positions(title_th)")
    .neq("status", "terminated").order("employee_code");
  if (error) throw error;
  return (data ?? []).map((r: any, i: number) => ({
    id: r.id, code: r.employee_code, name: `${r.first_name_th} ${r.last_name_th === "-" ? "" : r.last_name_th}`.trim(),
    nickname: r.nickname ?? undefined, position: r.position?.title_th ?? "", orgUnit: r.org_unit?.name_th ?? "",
    bu: "hq", color: COLORS[i % COLORS.length], managerId: r.manager_id,
    company: String(r.org_unit?.code ?? "").split("-")[0],
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
