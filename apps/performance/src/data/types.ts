// โครงสร้างข้อมูลฝั่งหน้าจอ — ตั้งชื่อตามตารางใน supabase/migrations เพื่อ map ได้ตรง
export type Role = "employee" | "manager" | "hr";
export type BU = "hq" | "retail" | "fmcg" | "factory";
export type GoalStatus = "draft" | "pending_approval" | "approved" | "on_track" | "at_risk" | "off_track" | "completed";
export type DataSource = "manual" | "pos" | "mes" | "qms" | "tna" | "lms" | "crm";
export type Direction = "higher_better" | "lower_better";

export interface Person {
  id: string;
  code: string;
  name: string;
  nickname?: string;
  position: string;
  orgUnit: string;
  bu: BU;
  color?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  type: "company" | "team" | "individual" | "development";
  kpiCode?: string;
  unit: string;
  direction: Direction;
  target: number;
  actual: number | null;
  weight: number;
  source: DataSource;
  status: GoalStatus;
  dueDate: string;
  parentId?: string;
  lastUpdated?: string;
  history?: number[]; // monthly actual (for sparkline)
}

export interface Checkin {
  id: string;
  date: string;
  withName: string;
  wentWell: string;
  challenges: string;
  supportNeeded: string;
  nextSteps: string;
  mood: number;
  progress: number;
  nextDate?: string;
}

export interface Feedback {
  id: string;
  fromId: string;
  toId: string;
  type: "praise" | "constructive" | "request";
  competency?: string;
  message: string;
  badge?: string;
  visibility: "private" | "manager" | "public";
  createdAt: string;
  isRead?: boolean;
}

export interface Competency {
  id: string;
  code: string;
  name: string;
  category: "core" | "leadership" | "functional";
  required: number;
  current: number;
}

export interface IdpAction {
  id: string;
  title: string;
  type: "experience" | "exposure" | "education";
  competency: string;
  dueDate: string;
  status: "not_started" | "in_progress" | "completed";
  progress: number;
  lmsCourse?: string;
  mentor?: string;
  note?: string;
}

export interface TeamMember extends Person {
  planStatus: "goal_pending" | "goal_approved" | "self_review" | "manager_review" | "calibration" | "released" | "acknowledged";
  goals: number;
  progress: number;
  health: "on_track" | "at_risk" | "off_track" | "no_goal";
  lastCheckin: string | null;
  selfScore: number | null;
  managerScore: number | null;
}

export interface CalibrationEntry {
  personId: string;
  performance: 1 | 2 | 3;
  potential: 1 | 2 | 3;
  preRating: number;
  rating: number;
  score: number;
}

export interface Todo {
  kind: "goal" | "approve" | "checkin" | "review" | "360" | "feedback" | "idp";
  title: string;
  subtitle: string;
  link: string;
  urgent?: boolean;
}

export interface IntegrationSource {
  code: string;
  name: string;
  desc: string;
  direction: "inbound" | "outbound" | "both";
  schedule: string;
  lastSync: string;
  records24h: number;
  failed24h: number;
  pending: number;
  status: "ok" | "warning" | "error";
}
