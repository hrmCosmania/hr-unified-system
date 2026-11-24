import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as mock from "./mock";
import type { CalibrationEntry, Checkin, Feedback, Goal, IdpAction, Person, Role } from "./types";
import { isLive } from "../lib/supabase";

interface Toast { id: number; text: string; tone: "good" | "info" | "crit" }

interface Store {
  live: boolean;
  role: Role;
  setRole: (r: Role) => void;
  signedIn: boolean;
  signIn: (r: Role) => void;
  signOut: () => void;
  me: Person;
  goals: Goal[];
  addGoal: (g: Omit<Goal, "id" | "status">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  goalsSubmitted: boolean;
  submitGoals: () => void;
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
  const [goals, setGoals] = useState<Goal[]>(mock.myGoals);
  const [goalsSubmitted, setGoalsSubmitted] = useState(true);
  const [checkins, setCheckins] = useState<Checkin[]>(mock.checkins);
  const [feedback, setFeedback] = useState<Feedback[]>(mock.feedback);
  const [idpActions, setIdp] = useState<IdpAction[]>(mock.idp.actions);
  const [calibration, setCal] = useState(mock.calibrationPeople);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "good") => {
    const id = ++seq;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo<Store>(() => ({
    live: isLive,
    role,
    setRole: (r) => { setRole(r); localStorageSet("gt-role", r); },
    signedIn,
    signIn: (r) => { setRole(r); setSignedIn(true); localStorageSet("gt-role", r); localStorageSet("gt-signed", "1"); },
    signOut: () => { setSignedIn(false); localStorageSet("gt-signed", "0"); },
    me: role === "hr" ? mock.people.hrd : mock.people.me,
    goals,
    addGoal: (g) => { setGoals((x) => [...x, { ...g, id: `g${++seq}`, status: "draft" }]); setGoalsSubmitted(false); },
    updateGoal: (id, patch) => { setGoals((x) => x.map((g) => (g.id === id ? { ...g, ...patch } : g))); },
    removeGoal: (id) => { setGoals((x) => x.filter((g) => g.id !== id)); setGoalsSubmitted(false); },
    goalsSubmitted,
    submitGoals: () => {
      setGoals((x) => x.map((g) => (g.status === "draft" ? { ...g, status: "pending_approval" } : g)));
      setGoalsSubmitted(true);
    },
    checkins,
    addCheckin: (c) => setCheckins((x) => [{ ...c, id: `ck${++seq}` }, ...x]),
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
  }), [role, signedIn, goals, goalsSubmitted, checkins, feedback, idpActions, calibration, toasts, toast]);

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
