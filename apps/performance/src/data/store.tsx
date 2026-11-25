import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as mock from "./mock";
import type { CalibrationEntry, Checkin, Competency, Feedback, Goal, IdpAction, Person, Role, TeamMember } from "./types";
import { hosted, isLive } from "../lib/supabase";
import * as live from "./live";
import type { Account, LiveCycle, LiveEmployee, LiveStatus, PosKpi } from "./live";

interface Toast { id: number; text: string; tone: "good" | "info" | "crit" }

interface Store {
  live: boolean;
  /** ข้อมูลจริง: demo = ข้อมูลตัวอย่าง · ready = ต่อฐานข้อมูลแล้ว · not_exposed = ยังไม่เปิด schema pm */
  liveStatus: LiveStatus;
  liveMessage: string;
  role: Role;
  setRole: (r: Role) => void;
  /** บัญชีที่ล็อกอินจริง (ระบบ HR รวมศูนย์) — null = โหมดตัวอย่าง */
  account: Account | null;
  /** บทบาทสูงสุดที่บัญชีนี้ดูได้ (ข้อมูลจริง) — เลือกมุมมองได้ไม่เกินนี้ */
  maxRole: Role;
  /** ทีมของพนักงานที่เลือก (ลูกทีมโดยตรง) พร้อมสถานะในรอบประเมิน — ข้อมูลจริง */
  team: TeamMember[];
  teamLoading: boolean;
  reloadTeam: () => void;
  /** หาพนักงานจาก id (ข้อมูลจริง: ทุกบริษัท · โหมดตัวอย่าง: รายชื่อตัวอย่าง) */
  personOf: (id: string) => Person;
  /** รายชื่อพนักงานทั้งบริษัทที่เลือก (ใช้เลือกผู้รับ Feedback ฯลฯ) */
  directory: LiveEmployee[];
  /** เป้าหมายอาชีพใน IDP ของพนักงานที่เลือก (ข้อมูลจริง) */
  idpAspiration: string;
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
  /** สร้างเป้าหมายฉบับร่างจาก KPI ตามตำแหน่ง (JD/KPI/Competency ในแอปหลัก) — ข้าม KPI ที่มีเป้าหมายแล้ว */
  goalsFromPositionKpis: () => void;
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
  /** แผนประเมินทุกคนในรอบ (ข้อมูลจริง) */
  livePlans: live.LivePlanRow[];
  reloadPlans: () => void;
  moveCalibration: (id: string, patch: Partial<CalibrationEntry>) => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const Ctx = createContext<Store | null>(null);
let seq = 100;
const COLORS = ["#2a78d6", "#6250d6", "#008300", "#eb6834", "#e87ba4", "#1baf7a", "#eda100", "#e34948"];
const RANK: Record<Role, number> = { employee: 0, manager: 1, hr: 2 };
const ROLE_LABEL: Record<Role, string> = { employee: "พนักงาน", manager: "หัวหน้างาน", hr: "HR / ผู้ดูแลระบบ" };

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
  const [account, setAccount] = useState<Account | null>(null);
  const [liveTeam, setLiveTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [liveFeedback, setLiveFeedback] = useState<Feedback[]>([]);
  const [liveIdp, setLiveIdp] = useState<IdpAction[]>([]);
  const [idpAspiration, setIdpAspiration] = useState("");
  const [livePlans, setLivePlans] = useState<live.LivePlanRow[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(hosted || isLive ? "checking" : "demo");
  const [liveMessage, setLiveMessage] = useState("");
  const [allEmployees, setEmployees] = useState<LiveEmployee[]>([]);
  // บริษัทที่ทำงาน (ร่วมกับระบบ HR รวมศูนย์ — /shared/company.js): รายชื่อให้เลือกเฉพาะพนักงานของบริษัทนั้น
  const [company, setCompany] = useState(() => window.HRUCompany?.get() ?? "");
  useEffect(() => window.HRUCompany?.onChange((c) => setCompany(c)), []);
  const maxRole: Role = account?.role ?? "hr";
  // รายชื่อที่บัญชีนี้บันทึกแทนได้: HR = ทุกคน (ตามบริษัท) · หัวหน้า = ตัวเอง + ลูกทีมทุกชั้น · พนักงาน = ตัวเอง
  const employees = useMemo(() => {
    let list = company ? allEmployees.filter((e) => !e.company || e.company === company) : allEmployees;
    if (account && account.role !== "hr") {
      const me = account.employeeId, keep = new Set<string>(me ? [me] : []);
      if (account.role === "manager" && me) {
        let added = true;
        while (added) { added = false; for (const e of allEmployees) if (e.managerId && keep.has(e.managerId) && !keep.has(e.id)) { keep.add(e.id); added = true; } }
      }
      list = allEmployees.filter((e) => keep.has(e.id));
    }
    return list;
  }, [allEmployees, company, account]);
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
        const [emps, cyc, acc] = await Promise.all([live.loadEmployees(), live.loadCycle(), live.whoami().catch(() => null)]);
        if (stop) return;
        setEmployees(emps); setCycle(cyc); setAccount(acc);
        // มุมมองตามสิทธิ์จริง: เลือกได้ไม่เกินบทบาทของบัญชี · พนักงานทั่วไปเริ่มที่ตัวเอง
        if (acc) {
          setRole((r) => (RANK[r] > RANK[acc.role] ? acc.role : r));
          if (acc.employeeId && acc.role !== "hr") setSubjectIdState(acc.employeeId);
        }
        setLiveStatus("ready");
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

  // ทีม: ลูกทีมโดยตรงของพนักงานที่เลือก (HR) หรือของตัวเอง (หัวหน้างาน)
  const teamLeadId = account && account.role === "manager" && account.employeeId ? account.employeeId : subject?.id ?? null;
  const teamMembers = useMemo(() => allEmployees.filter((e) => teamLeadId && e.managerId === teamLeadId), [allEmployees, teamLeadId]);
  const reloadTeam = useCallback(() => {
    if (!ready || !cycle) { setLiveTeam([]); return; }
    setTeamLoading(true);
    live.loadTeamStatus(cycle.id, teamMembers).then(setLiveTeam, fail).finally(() => setTeamLoading(false));
  }, [ready, cycle, teamMembers, fail]);
  useEffect(() => { reloadTeam(); }, [reloadTeam]);

  // Feedback และ IDP ของพนักงานที่เลือก
  const subjectKey = subject?.id ?? "";
  const reloadFeedback = useCallback(() => {
    if (!ready || !subjectKey) { setLiveFeedback([]); return; }
    live.loadFeedback(subjectKey).then(setLiveFeedback, fail);
  }, [ready, subjectKey, fail]);
  const reloadIdp = useCallback(() => {
    if (!ready || !subjectKey || !cycle) { setLiveIdp([]); return; }
    live.loadIdp(subjectKey, cycle.id).then((x) => { setLiveIdp(x.actions); setIdpAspiration(x.aspiration); }, fail);
  }, [ready, subjectKey, cycle, fail]);
  useEffect(() => { reloadFeedback(); reloadIdp(); }, [reloadFeedback, reloadIdp]);

  // แผนประเมินทั้งรอบ (Calibration / Analytics) — HR เท่านั้นที่เห็นทุกคน (RLS)
  const reloadPlans = useCallback(() => {
    if (!ready || !cycle) { setLivePlans([]); return; }
    live.loadPlans(cycle.id).then(setLivePlans, fail);
  }, [ready, cycle, fail]);
  useEffect(() => { reloadPlans(); }, [reloadPlans]);
  const liveCalibration = useMemo(() => {
    const tier = (r: number) => (r <= 2 ? 1 : r === 3 ? 2 : 3) as 1 | 2 | 3;
    return livePlans.filter((p) => !company || !p.company || p.company === company).map((p, i) => {
      const pre = p.finalRating ?? (p.overall != null ? Math.round(p.overall) : 3);
      const rating = p.calibrated ?? pre;
      return { id: p.planId, code: p.code, name: p.name, position: p.position, orgUnit: p.orgUnit, bu: "hq" as const, color: COLORS[i % COLORS.length],
        personId: p.employeeId, performance: tier(rating), potential: (Math.min(3, Math.max(1, p.potential ?? 2))) as 1 | 2 | 3,
        preRating: pre, rating, score: p.overall ?? 0 };
    });
  }, [livePlans, company]);

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
    setRole: (r) => { const x = ready && RANK[r] > RANK[maxRole] ? maxRole : r; setRole(x); localStorageSet("gt-role", x); },
    account,
    maxRole,
    team: ready ? liveTeam : mock.team,
    teamLoading,
    reloadTeam,
    idpAspiration,
    directory: company ? allEmployees.filter((e) => !e.company || e.company === company) : allEmployees,
    personOf: (id) => (ready ? allEmployees.find((e) => e.id === id) ?? { id, code: "-", name: "ไม่ทราบชื่อ", position: "", orgUnit: "", bu: "hq" } : person(id)),
    signedIn,
    signIn: (r) => { setRole(r); setSignedIn(true); localStorageSet("gt-role", r); localStorageSet("gt-signed", "1"); },
    signOut: () => { setSignedIn(false); localStorageSet("gt-signed", "0"); },
    // ผู้ใช้ที่ล็อกอินจริง (ไม่ใช่พนักงานที่เลือกบันทึกแทน)
    me: ready && account
      ? (() => { const e = allEmployees.find((x) => x.id === account.employeeId);
          return e ? { ...e } : { id: account.userId, code: account.email, name: account.name, position: ROLE_LABEL[account.role], orgUnit: account.email, bu: "hq" as const }; })()
      : role === "hr" ? mock.people.hrd : mock.people.me,
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
    goalsFromPositionKpis: () => {
      if (!ready || !cycle || !subject || !posKpis.length) return;
      const have = new Set(liveGoals.map((g) => g.kpiCode).filter(Boolean));
      const todo = posKpis.filter((k) => !have.has(k.code));
      if (!todo.length) { toast("KPI ตามตำแหน่งมีเป้าหมายครบแล้ว", "info"); return; }
      // น้ำหนักตาม KPI ในแอปหลัก · ไม่มีน้ำหนัก → เฉลี่ยเท่ากัน
      const even = Math.floor(100 / todo.length);
      run(async () => {
        const planId = await ensurePlanId();
        for (const k of todo) {
          const n = Number(((k.target ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/) ?? [""])[0]);
          await live.createGoal(cycle.id, planId, subject.id, {
            title: k.name, description: [k.target && `เป้าหมาย: ${k.target}`, k.formula && `สูตร: ${k.formula}`, k.frequency && `ความถี่: ${k.frequency}`].filter(Boolean).join("\n"),
            type: "individual", kpiCode: k.code, unit: k.unit || "%", direction: k.direction, target: n > 0 ? n : 100, actual: null,
            weight: k.weight ?? even, source: "manual", dueDate: cycle.endDate,
          }, cycle.endDate);
        }
      }, `สร้างเป้าหมายจาก KPI ตามตำแหน่ง ${todo.length} ข้อแล้ว (ฉบับร่าง — ปรับค่าเป้าหมายได้ที่หน้าเป้าหมาย)`, reloadGoals);
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
    feedback: ready ? liveFeedback : feedback,
    sendFeedback: (f) => {
      if (!ready) { setFeedback((x) => [{ ...f, id: `f${++seq}`, createdAt: mock.TODAY }, ...x]); return; }
      const compId = posComps.find((c) => c.name === f.competency)?.id;
      run(() => live.createFeedback(f, compId), undefined, async () => reloadFeedback());
    },
    markFeedbackRead: () => {
      if (!ready) { setFeedback((x) => x.map((f) => ({ ...f, isRead: true }))); return; }
      if (subjectKey) run(() => live.markFeedbackRead(subjectKey), undefined, async () => reloadFeedback());
    },
    idpActions: ready ? liveIdp : idpActions,
    addIdpAction: (a) => {
      if (!ready) { setIdp((x) => [...x, { ...a, id: `a${++seq}` }]); return; }
      if (!cycle || !subject) { toast("ยังไม่มีรอบประเมินหรือยังไม่ได้เลือกพนักงาน", "crit"); return; }
      const compId = posComps.find((c) => c.name === a.competency)?.id;
      run(async () => live.addIdpAction(await live.ensureIdp(subject.id, cycle.id), a, compId), "เพิ่มแผนพัฒนาแล้ว", async () => reloadIdp());
    },
    updateIdpAction: (id, patch) => {
      if (!ready) { setIdp((x) => x.map((a) => (a.id === id ? { ...a, ...patch } : a))); return; }
      run(() => live.updateIdpAction(id, patch), undefined, async () => reloadIdp());
    },
    calibration: ready ? liveCalibration : calibration,
    livePlans,
    reloadPlans,
    moveCalibration: (id, patch) => {
      if (!ready) { setCal((x) => x.map((p) => (p.id === id ? { ...p, ...patch } : p))); return; }
      // ย้ายช่อง 9-Box: ผลงาน (แนวนอน) → ผลประเมินหลังปรับ · ศักยภาพ (แนวตั้ง) → potential_rating
      const row: { calibrated_rating?: number; potential_rating?: number } = {};
      if (patch.rating != null) row.calibrated_rating = patch.rating;
      else if (patch.performance != null) row.calibrated_rating = patch.performance === 1 ? 2 : patch.performance === 2 ? 3 : 4;
      if (patch.potential != null) row.potential_rating = patch.potential;
      run(() => live.saveCalibration(id, row), undefined, async () => reloadPlans());
    },
    toasts,
    toast,
  }), [role, signedIn, demoGoals, demoSubmitted, demoCheckins, feedback, idpActions, calibration, toasts, toast,
      account, maxRole, allEmployees, company, posComps, liveCalibration, livePlans, reloadPlans, liveTeam, teamLoading, reloadTeam, liveFeedback, liveIdp, idpAspiration, reloadFeedback, reloadIdp, subjectKey,
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
