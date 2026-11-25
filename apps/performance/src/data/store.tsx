import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as mock from "./mock";
import type { CalibrationEntry, Checkin, Competency, Feedback, Goal, IdpAction, Person, Role } from "./types";
import { hosted, isLive } from "../lib/supabase";
import * as live from "./live";
import type { LiveCycle, LiveEmployee, LiveStatus, PosKpi } from "./live";

interface Toast { id: number; text: string; tone: "good" | "info" | "crit" }

interface Store {
  live: boolean;
  /** ข้อมูลจริง: demo = ข้อมูลตัวอย่าง · ready = ต่อฐานข้อมูลแล้ว · not_exposed = ยังไม่เปิด schema pm */
  liveStatus: LiveStatus;
  liveMessage: string;
  role: Role;
  setRole: (r: Role) => void;
  signedIn: boolean;
  signIn: (r: Role) => void;
  signOut: () => void;
  me: Person;
  /** HR บันทึกแทนพนักงาน: รายชื่อพนักงาน และคนที่เลือกอยู่ */
  employees: LiveEmployee[];
  subjectId: string;
  setSubjectId: (id: string) => void;
  subject: LiveEmployee | null;
  managerOf: (e: LiveEmployee | null) => LiveEmployee | null;
  cycle: LiveCycle | null;
  ensurePlanId: () => Promise<string>;
  /** KPI / Competency ของตำแหน่งพนักงานที่เลือก (จาก JD/KPI/Competency ในแอปหลัก) — ว่าง = ยังไม่มี/โหมดตัวอย่าง */
  posKpis: PosKpi[];
  posComps: Competency[];
  goals: Goal[];
  addGoal: (g: Omit<Goal, "id" | "status">) => void;
  updateGoal: (id: string, patch: Partial<Goal>, note?: string) => void;
  removeGoal: (id: string) => void;
  goalsSubmitted: boolean;
  submitGoals: () => void;
  approveGoals: () => void;
  checkins: Checkin[];
  addCheckin: (c: Omit<Checkin, "id">) => void;
  feedback: Feedback[];
  sendFeedback: (f: Omit<Feedback, "id" | "createdAt">) => void;
  markFeedbackRead: () => void;
  idpActions: IdpAction[];
  addIdpAction: (a: Omit<IdpAction, "id">) => void;
  updateIdpAction: (id: string, patch: Partial<IdpAction>) => void;
  calibration: typeof mock.calibrationPeople;
  moveCalibration: (id: string, patch: Partial<CalibrationEntry>) => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const Ctx = createContext<Store | null>(null);
let seq = 100;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => (localStorageGet("gt-role") as Role) || "employee");
  const [signedIn, setSignedIn] = useState(() => localStorageGet("gt-signed") === "1");
  const [demoGoals, setDemoGoals] = useState<Goal[]>(mock.myGoals);
  const [demoSubmitted, setDemoSubmitted] = useState(true);
  const [demoCheckins, setDemoCheckins] = useState<Checkin[]>(mock.checkins);
  const [feedback, setFeedback] = useState<Feedback[]>(mock.feedback);
  const [idpActions, setIdp] = useState<IdpAction[]>(mock.idp.actions);
  const [calibration, setCal] = useState(mock.calibrationPeople);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ---------- ข้อมูลจริง ----------
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(hosted || isLive ? "checking" : "demo");
  const [liveMessage, setLiveMessage] = useState("");
  const [allEmployees, setEmployees] = useState<LiveEmployee[]>([]);
  // บริษัทที่ทำงาน (ร่วมกับระบบ HR รวมศูนย์ — /shared/company.js): รายชื่อให้เลือกเฉพาะพนักงานของบริษัทนั้น
  const [company, setCompany] = useState(() => window.HRUCompany?.get() ?? "");
  useEffect(() => window.HRUCompany?.onChange((c) => setCompany(c)), []);
  const employees = useMemo(() => (company ? allEmployees.filter((e) => !e.company || e.company === company) : allEmployees), [allEmployees, company]);
  const [subjectId, setSubjectIdState] = useState(() => localStorageGet("gt-subject") ?? "");
  const [cycle, setCycle] = useState<LiveCycle | null>(null);
  const [liveGoals, setLiveGoals] = useState<Goal[]>([]);
  const [liveCheckins, setLiveCheckins] = useState<Checkin[]>([]);
  const [posKpis, setPosKpis] = useState<PosKpi[]>([]);
  const [posComps, setPosComps] = useState<Competency[]>([]);
  const ready = liveStatus === "ready";

  const toast = useCallback((text: string, tone: Toast["tone"] = "good") => {
    const id = ++seq;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  const fail = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
    toast(msg, "crit");
  }, [toast]);

  // เปิดในระบบ HR + ล็อกอินแล้ว → ตรวจว่าเรียก schema pm ได้ แล้วโหลดรายชื่อพนักงานและรอบประเมิน
  useEffect(() => { if (hosted && signedIn) window.HRUCompany?.ensure(); }, [signedIn]);

  useEffect(() => {
    if (!(hosted || isLive) || !signedIn) return;
    let stop = false;
    (async () => {
      try {
        const p = await live.probe();
        if (stop) return;
        if (p.status !== "ready") { setLiveStatus(p.status); setLiveMessage(p.message ?? ""); return; }
        const [emps, cyc] = await Promise.all([live.loadEmployees(), live.loadCycle()]);
        if (stop) return;
        setEmployees(emps); setCycle(cyc); setLiveStatus("ready");
      } catch (e) {
        if (!stop) { setLiveStatus("error"); setLiveMessage(e instanceof Error ? e.message : String(e)); }
      }
    })();
    return () => { stop = true; };
  }, [signedIn]);

  const subject = useMemo(() => employees.find((e) => e.id === subjectId) ?? employees[0] ?? null, [employees, subjectId]);
  const setSubjectId = useCallback((id: string) => { setSubjectIdState(id); localStorageSet("gt-subject", id); }, []);
  // หัวหน้างานอาจอยู่บริษัทในเครือ → ค้นจากพนักงานทุกบริษัท
  const managerOf = useCallback((e: LiveEmployee | null) => (e?.managerId ? allEmployees.find((x) => x.id === e.managerId) ?? null : null), [allEmployees]);

  const reloadGoals = useCallback(async () => {
    if (!ready || !cycle || !subject) return;
    try { setLiveGoals(await live.loadGoals(cycle.id, subject.id)); } catch (e) { fail(e); }
  }, [ready, cycle, subject, fail]);
  const reloadCheckins = useCallback(async () => {
    if (!ready || !subject) return;
    try { setLiveCheckins(await live.loadCheckins(subject.id)); } catch (e) { fail(e); }
  }, [ready, subject, fail]);
  useEffect(() => { setLiveGoals([]); setLiveCheckins([]); reloadGoals(); reloadCheckins(); }, [reloadGoals, reloadCheckins]);

  // KPI / Competency ตามตำแหน่งของพนักงานที่เลือก
  const positionId = subject?.positionId ?? null;
  useEffect(() => {
    setPosKpis([]); setPosComps([]);
    if (!ready || !positionId) return;
    let stop = false;
    live.loadFramework(positionId).then((f) => { if (!stop) { setPosKpis(f.kpis); setPosComps(f.comps); } }, fail);
    return () => { stop = true; };
  }, [ready, positionId, fail]);

  const ensurePlanId = useCallback(async () => {
    if (!cycle || !subject) throw new Error("ยังไม่มีรอบประเมินหรือยังไม่ได้เลือกพนักงาน");
    return live.ensurePlan(cycle.id, subject);
  }, [cycle, subject]);

  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string, after?: () => Promise<void>) => {
    try { await fn(); if (after) await after(); if (ok) toast(ok); } catch (e) { fail(e); }
  }, [toast, fail]);

  const value = useMemo<Store>(() => ({
    live: isLive || ready,
    liveStatus,
    liveMessage,
    role,
    setRole: (r) => { setRole(r); localStorageSet("gt-role", r); },
    signedIn,
    signIn: (r) => { setRole(r); setSignedIn(true); localStorageSet("gt-role", r); localStorageSet("gt-signed", "1"); },
    signOut: () => { setSignedIn(false); localStorageSet("gt-signed", "0"); },
    me: ready && subject ? subject : role === "hr" ? mock.people.hrd : mock.people.me,
    employees,
    subjectId: subject?.id ?? "",
    setSubjectId,
    subject,
    managerOf,
    cycle,
    ensurePlanId,
    posKpis,
    posComps,
    goals: ready ? liveGoals : demoGoals,
    addGoal: (g) => {
      if (!ready) { setDemoGoals((x) => [...x, { ...g, id: `g${++seq}`, status: "draft" }]); setDemoSubmitted(false); return; }
      run(async () => {
        const planId = await ensurePlanId();
        await live.createGoal(cycle!.id, planId, subject!.id, { ...g, parentId: undefined, dueDate: cycle!.endDate }, cycle!.endDate);
      }, undefined, reloadGoals);
    },
    updateGoal: (id, patch, note) => {
      if (!ready) { setDemoGoals((x) => x.map((g) => (g.id === id ? { ...g, ...patch } : g))); return; }
      if (patch.actual != null) run(() => live.updateGoalActual(id, patch.actual as number, note ?? ""), undefined, reloadGoals);
    },
    removeGoal: (id) => {
      if (!ready) { setDemoGoals((x) => x.filter((g) => g.id !== id)); setDemoSubmitted(false); return; }
      run(() => live.deleteGoal(id), "ลบเป้าหมายแล้ว", reloadGoals);
    },
    goalsSubmitted: ready ? !liveGoals.some((g) => g.status === "draft") : demoSubmitted,
    submitGoals: () => {
      if (!ready) {
        setDemoGoals((x) => x.map((g) => (g.status === "draft" ? { ...g, status: "pending_approval" } : g)));
        setDemoSubmitted(true); return;
      }
      run(() => live.setGoalsStatus(cycle!.id, subject!.id, "draft", "pending_approval"), undefined, reloadGoals);
    },
    approveGoals: () => {
      if (!ready) { setDemoGoals((x) => x.map((g) => (g.status === "pending_approval" ? { ...g, status: "approved" } : g))); return; }
      run(() => live.setGoalsStatus(cycle!.id, subject!.id, "pending_approval", "approved"), "อนุมัติเป้าหมายแล้ว", reloadGoals);
    },
    checkins: ready ? liveCheckins : demoCheckins,
    addCheckin: (c) => {
      if (!ready) { setDemoCheckins((x) => [{ ...c, id: `ck${++seq}` }, ...x]); return; }
      run(() => live.createCheckin(cycle!.id, subject!, c), undefined, reloadCheckins);
    },
    feedback,
    sendFeedback: (f) => setFeedback((x) => [{ ...f, id: `f${++seq}`, createdAt: mock.TODAY }, ...x]),
    markFeedbackRead: () => setFeedback((x) => x.map((f) => ({ ...f, isRead: true }))),
    idpActions,
    addIdpAction: (a) => setIdp((x) => [...x, { ...a, id: `a${++seq}` }]),
    updateIdpAction: (id, patch) => setIdp((x) => x.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    calibration,
    moveCalibration: (id, patch) => setCal((x) => x.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    toasts,
    toast,
  }), [role, signedIn, demoGoals, demoSubmitted, demoCheckins, feedback, idpActions, calibration, toasts, toast,
      ready, liveStatus, liveMessage, employees, subject, posKpis, posComps, setSubjectId, managerOf, cycle, ensurePlanId, liveGoals, liveCheckins,
      run, reloadGoals, reloadCheckins]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export function person(id: string): Person {
  return mock.people[id] ?? { id, code: "-", name: id, position: "", orgUnit: "", bu: "hq" };
}

function localStorageGet(k: string) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function localStorageSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
}
