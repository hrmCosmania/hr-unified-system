// ข้อมูลตัวอย่างสำหรับโหมด Demo (ใช้เมื่อยังไม่ได้ตั้งค่า Supabase)
import type {
  CalibrationEntry, Checkin, Competency, Feedback, Goal, IdpAction, IntegrationSource, Person, TeamMember, Todo,
} from "./types";

export const TODAY = "2026-11-24";

export const people: Record<string, Person> = {
  me:   { id: "me",   code: "E10234", name: "สมชาย ใจดี", nickname: "ชาย", position: "Store Supervisor", orgUnit: "สาขาบางนา (ST045)", bu: "retail", color: "#2a78d6" },
  mgr:  { id: "mgr",  code: "E08812", name: "วิภาวดี ศรีสุข", nickname: "วิภา", position: "Store Manager", orgUnit: "สาขาบางนา (ST045)", bu: "retail", color: "#6250d6" },
  am:   { id: "am",   code: "E05120", name: "ประเสริฐ มั่นคง", position: "Area Manager", orgUnit: "เขตกรุงเทพฯ ตะวันออก", bu: "retail", color: "#008300" },
  hrd:  { id: "hrd",  code: "E01007", name: "นภัสสร วงศ์ใหญ่", position: "HR Director", orgUnit: "ฝ่ายทรัพยากรบุคคล", bu: "hq", color: "#eb6834" },
  t1:   { id: "t1",   code: "E11402", name: "ศิรินทร์ บุญมา", position: "Senior Sales Staff", orgUnit: "สาขาบางนา", bu: "retail", color: "#e87ba4" },
  t2:   { id: "t2",   code: "E11877", name: "วีระ กล้าหาญ", position: "Sales Staff", orgUnit: "สาขาบางนา", bu: "retail", color: "#1baf7a" },
  t3:   { id: "t3",   code: "E12011", name: "กนกพร ดีงาม", position: "Cashier", orgUnit: "สาขาบางนา", bu: "retail", color: "#eda100" },
  t4:   { id: "t4",   code: "E12233", name: "ธนวัฒน์ รุ่งเรือง", position: "Stock Staff", orgUnit: "สาขาบางนา", bu: "retail", color: "#2a78d6" },
  t5:   { id: "t5",   code: "E12409", name: "พิมพ์ชนก แก้วใส", position: "Sales Staff", orgUnit: "สาขาบางนา", bu: "retail", color: "#6250d6" },
  t6:   { id: "t6",   code: "E12560", name: "อนุชา สายทอง", position: "Visual Merchandiser", orgUnit: "สาขาบางนา", bu: "retail", color: "#eb6834" },
  t7:   { id: "t7",   code: "E12788", name: "จิราพร ใจเย็น", position: "Cashier", orgUnit: "สาขาบางนา", bu: "retail", color: "#008300" },
  t8:   { id: "t8",   code: "E12901", name: "ณัฐพล ศักดิ์ดี", position: "Sales Staff (Probation)", orgUnit: "สาขาบางนา", bu: "retail", color: "#e34948" },
  p1:   { id: "p1",   code: "E30211", name: "สุริยา ทองคำ", position: "Line Leader", orgUnit: "โรงงานบางปะกง · Line 3", bu: "factory", color: "#1baf7a" },
  p2:   { id: "p2",   code: "E30554", name: "มาลัย ศรีงาม", position: "QC Officer", orgUnit: "โรงงานบางปะกง · QC", bu: "factory", color: "#eda100" },
  p3:   { id: "p3",   code: "E20118", name: "ภูมิ พัฒนกุล", position: "Key Account Executive", orgUnit: "FMCG · Modern Trade", bu: "fmcg", color: "#2a78d6" },
  p4:   { id: "p4",   code: "E02290", name: "ชลธิชา นาคสวัสดิ์", position: "HR Business Partner", orgUnit: "ฝ่ายทรัพยากรบุคคล", bu: "hq", color: "#e87ba4" },
};

export const cycle = {
  name: "ประเมินผล 2026",
  phases: [
    { key: "goal_setting", label: "ตั้งเป้าหมาย", range: "1 ม.ค. – 15 ก.พ.", state: "done" },
    { key: "checkin", label: "Check-in", range: "ทุกเดือน", state: "done" },
    { key: "mid_year", label: "Mid-year Review", range: "1 – 31 ก.ค.", state: "done" },
    { key: "feedback_360", label: "360° Feedback", range: "1 – 31 ต.ค.", state: "done" },
    { key: "year_end", label: "ประเมินปลายปี", range: "16 พ.ย. – 15 ธ.ค.", state: "current" },
    { key: "calibration", label: "Calibration", range: "16 – 23 ธ.ค.", state: "todo" },
    { key: "result", label: "สรุปผล", range: "ม.ค. 2027", state: "todo" },
  ] as const,
};

export const companyGoals: Goal[] = [
  { id: "c1", title: "ยอดขายรวมกลุ่มบริษัทเติบโต 12%", type: "company", unit: "%", direction: "higher_better", target: 12, actual: 10.4, weight: 0, source: "manual", status: "on_track", dueDate: "2026-12-31" },
  { id: "c2", title: "Retail: ยอดขายสาขาเดิม (LFL) +8%", type: "team", unit: "%", direction: "higher_better", target: 8, actual: 7.1, weight: 0, source: "pos", status: "on_track", dueDate: "2026-12-31", parentId: "c1" },
  { id: "c3", title: "สาขาบางนา: ยอดขาย 120 ล้านบาท", type: "team", unit: "ล้านบาท", direction: "higher_better", target: 120, actual: 108.5, weight: 0, source: "pos", status: "on_track", dueDate: "2026-12-31", parentId: "c2" },
];

export const myGoals: Goal[] = [
  { id: "g1", title: "ยอดขายแผนกที่รับผิดชอบ", description: "แผนกของใช้ในบ้าน + เครื่องดื่ม", type: "individual", kpiCode: "RT-SALES", unit: "บาท", direction: "higher_better", target: 12_000_000, actual: 10_850_000, weight: 35, source: "pos", status: "on_track", dueDate: "2026-12-31", parentId: "c3", lastUpdated: "เมื่อคืน 23:15", history: [0.8, 1.7, 2.7, 3.6, 4.5, 5.5, 6.4, 7.4, 8.4, 9.6, 10.85] },
  { id: "g2", title: "ลดสินค้าสูญหาย (Shrinkage)", description: "ไม่เกิน 2% ของยอดขาย", type: "individual", kpiCode: "RT-SHRINK", unit: "%", direction: "lower_better", target: 2, actual: 1.6, weight: 15, source: "pos", status: "on_track", dueDate: "2026-12-31", lastUpdated: "เมื่อคืน 23:15", history: [2.4, 2.3, 2.1, 2.0, 1.9, 1.8, 1.8, 1.7, 1.7, 1.6, 1.6] },
  { id: "g3", title: "คะแนนความพึงพอใจลูกค้า (CSAT)", description: "ไม่ต่ำกว่า 85 คะแนน", type: "individual", kpiCode: "RT-CSAT", unit: "คะแนน", direction: "higher_better", target: 85, actual: 79, weight: 20, source: "crm", status: "at_risk", dueDate: "2026-12-31", lastUpdated: "2 วันที่แล้ว", history: [81, 82, 80, 83, 84, 82, 80, 79, 78, 79, 79] },
  { id: "g4", title: "ความถูกต้องของสต็อก", description: "ตรวจนับรอบเดือนแม่นยำ ≥ 98%", type: "individual", kpiCode: "RT-STOCK-ACC", unit: "%", direction: "higher_better", target: 98, actual: 97.4, weight: 15, source: "pos", status: "on_track", dueDate: "2026-12-31", lastUpdated: "1 พ.ย. 2026", history: [95, 96, 96.5, 97, 96.8, 97.1, 97.3, 97.2, 97.4, 97.4] },
  { id: "g5", title: "ทีมผ่านหลักสูตรมาตรฐานบริการ 100%", description: "พนักงานในทีม 8 คน ผ่าน Service Excellence", type: "individual", kpiCode: "LMS-SERVICE", unit: "%", direction: "higher_better", target: 100, actual: 75, weight: 15, source: "lms", status: "at_risk", dueDate: "2026-12-31", lastUpdated: "วันนี้ 09:00", history: [0, 0, 12, 25, 25, 38, 50, 50, 62, 75, 75] },
];

export const checkins: Checkin[] = [
  { id: "ck4", date: "2026-11-03", withName: "วิภาวดี ศรีสุข", wentWell: "ยอดขายเดือน ต.ค. เกินเป้า 6% จากโปรโมชันเครื่องดื่ม", challenges: "CSAT ช่วงเย็นต่ำ เพราะคิวแคชเชียร์ยาว", supportNeeded: "ขอเพิ่มแคชเชียร์ Part-time ช่วง 17:00–20:00", nextSteps: "ทดลองเปิดเคาน์เตอร์ Express 2 สัปดาห์ แล้ววัดผล CSAT", mood: 4, progress: 88, nextDate: "2026-11-28" },
  { id: "ck3", date: "2026-10-02", withName: "วิภาวดี ศรีสุข", wentWell: "Shrinkage ลดลงต่อเนื่อง หลังจัดโซนสินค้ามูลค่าสูงใหม่", challenges: "พนักงานใหม่ 2 คนยังไม่ผ่านหลักสูตรบริการ", supportNeeded: "ขอรอบอบรม On-the-job เพิ่ม", nextSteps: "จับคู่ Buddy ให้พนักงานใหม่", mood: 4, progress: 81 },
  { id: "ck2", date: "2026-09-01", withName: "วิภาวดี ศรีสุข", wentWell: "ทีมช่วยกันปิดยอด Back-to-school ได้ตามเป้า", challenges: "สต็อกคลาดเคลื่อนช่วงรับสินค้า", supportNeeded: "ขอคู่มือ SOP การรับสินค้าฉบับใหม่", nextSteps: "ตรวจนับ Cycle count ทุกสัปดาห์", mood: 3, progress: 74 },
  { id: "ck1", date: "2026-08-01", withName: "วิภาวดี ศรีสุข", wentWell: "ผ่าน Mid-year review ด้วยผล 'เกินความคาดหวัง'", challenges: "ยังไม่มั่นใจการอ่านรายงาน P&L สาขา", supportNeeded: "แนะนำหลักสูตร Store P&L", nextSteps: "เพิ่มใน IDP", mood: 5, progress: 66 },
];

export const badges: Record<string, { label: string; emoji: string }> = {
  customer_hero: { label: "Customer Hero", emoji: "🛍️" },
  team_player: { label: "Team Player", emoji: "🤝" },
  safety_star: { label: "Safety Star", emoji: "🦺" },
  problem_solver: { label: "Problem Solver", emoji: "💡" },
  extra_mile: { label: "Go the Extra Mile", emoji: "🚀" },
};

export const feedback: Feedback[] = [
  { id: "f1", fromId: "mgr", toId: "me", type: "praise", competency: "มุ่งเน้นลูกค้า", message: "ขอบคุณที่ช่วยแก้ปัญหาลูกค้าคืนสินค้าเมื่อวันเสาร์ได้อย่างใจเย็นและรวดเร็ว ลูกค้าชมในโซเชียลด้วย 👏", badge: "customer_hero", visibility: "public", createdAt: "2026-11-22", isRead: false },
  { id: "f2", fromId: "t1", toId: "me", type: "praise", competency: "การสอนงาน", message: "พี่ชายสอนวิธีจัดเรียงสินค้าตาม Planogram เข้าใจง่ายมาก ตอนนี้ทำเองได้แล้วค่ะ", badge: "team_player", visibility: "manager", createdAt: "2026-11-20", isRead: false },
  { id: "f3", fromId: "mgr", toId: "me", type: "constructive", competency: "การวิเคราะห์ข้อมูล", message: "รายงานยอดขายรายสัปดาห์ควรมีการวิเคราะห์สาเหตุเพิ่ม ไม่ใช่แค่ตัวเลข ลองใช้ Dashboard ใน Power BI ที่ทีม HQ ทำไว้", visibility: "private", createdAt: "2026-11-10", isRead: true },
  { id: "f4", fromId: "am", toId: "me", type: "praise", competency: "ภาวะผู้นำ", message: "ทีมสาขาบางนาจัดงาน Mid-night sale ได้เรียบร้อย ไม่มีเหตุการณ์ไม่คาดฝัน ขอบคุณมากครับ", badge: "extra_mile", visibility: "public", createdAt: "2026-10-28", isRead: true },
  { id: "f5", fromId: "me", toId: "t3", type: "praise", competency: "ซื่อสัตย์และรับผิดชอบ", message: "ขอบคุณที่แจ้งเงินทอนเกินและคืนลูกค้าทันที เป็นแบบอย่างที่ดีมาก", badge: "customer_hero", visibility: "public", createdAt: "2026-11-18" },
  { id: "f6", fromId: "me", toId: "t4", type: "constructive", competency: "ความถูกต้องในงาน", message: "การรับสินค้ารอบเช้าควรสแกนทุกกล่องก่อนเซ็นรับ ช่วยลดสต็อกคลาดเคลื่อนได้มาก", visibility: "private", createdAt: "2026-11-12" },
];

export const recognitionWall: Feedback[] = [
  feedback[0],
  { id: "w2", fromId: "p2", toId: "p1", type: "praise", message: "Line 3 ไม่มีอุบัติเหตุ 365 วันติดต่อกัน! ขอบคุณที่ดูแลเรื่องความปลอดภัยทุกกะ", badge: "safety_star", visibility: "public", createdAt: "2026-11-21" },
  { id: "w3", fromId: "p4", toId: "p3", type: "praise", message: "ปิดดีลกับ Modern Trade รายใหม่ได้ก่อนกำหนด 1 เดือน", badge: "extra_mile", visibility: "public", createdAt: "2026-11-19" },
  feedback[4],
  { id: "w5", fromId: "p1", toId: "p2", type: "praise", message: "เสนอไอเดียปรับจุดตรวจ QC ทำให้ของเสียลดลง 0.4%", badge: "problem_solver", visibility: "public", createdAt: "2026-11-15" },
  feedback[3],
];

export const feedbackRequests = [
  { id: "rq1", fromId: "t6", topic: "การจัด Display หน้าร้านช่วงคริสต์มาส", due: "30 พ.ย." },
];

export const competencies: Competency[] = [
  { id: "k1", code: "CORE-CUST", name: "มุ่งเน้นลูกค้า", category: "core", required: 4, current: 4.5 },
  { id: "k2", code: "CORE-TEAM", name: "ทำงานเป็นทีม", category: "core", required: 4, current: 4 },
  { id: "k3", code: "CORE-INTEG", name: "ซื่อสัตย์และรับผิดชอบ", category: "core", required: 4, current: 4.5 },
  { id: "k4", code: "LEAD-COACH", name: "การสอนงานและพัฒนาทีม", category: "leadership", required: 4, current: 3 },
  { id: "k5", code: "LEAD-COMM", name: "การสื่อสาร", category: "leadership", required: 3, current: 3.5 },
  { id: "k6", code: "FN-STOREOPS", name: "การบริหารงานสาขา", category: "functional", required: 4, current: 3.5 },
  { id: "k7", code: "FN-PNL", name: "การบริหารกำไร-ขาดทุนสาขา", category: "functional", required: 4, current: 2.5 },
  { id: "k8", code: "FN-DATA", name: "การวิเคราะห์ข้อมูลการขาย", category: "functional", required: 3, current: 2 },
];

// 360° — เฉลี่ยราย competency × กลุ่มผู้ประเมิน
export const radar360 = {
  axes: ["มุ่งเน้นลูกค้า", "ทำงานเป็นทีม", "การสื่อสาร", "ภาวะผู้นำ", "การแก้ปัญหา", "การวิเคราะห์ข้อมูล"],
  series: [
    { key: "self", label: "ตนเอง", n: 1, values: [4.5, 4.0, 4.0, 3.5, 4.0, 3.0] },
    { key: "manager", label: "หัวหน้า", n: 1, values: [4.5, 4.0, 3.5, 3.5, 4.0, 2.5] },
    { key: "peer", label: "เพื่อนร่วมงาน", n: 4, values: [4.6, 4.4, 3.8, 3.6, 3.9, 2.8] },
    { key: "report", label: "ลูกทีม", n: 6, values: [4.3, 4.5, 3.4, 3.9, 4.1, 3.1] },
  ],
  comments: {
    strengths: ["ใจเย็น รับมือลูกค้าที่ไม่พอใจได้ดีมาก", "ช่วยเหลือทีมเสมอ ลงมือทำเองเป็นตัวอย่าง", "จัดตารางกะได้ยุติธรรม"],
    improve: ["อยากให้สื่อสารเป้ายอดขายรายวันให้ทีมชัดขึ้น", "ควรมอบหมายงานให้ลูกทีมมากขึ้น ไม่ทำเองทั้งหมด"],
  },
  pending: [
    { id: "r1", personId: "t1", relation: "ลูกทีม", due: "ปิดแล้ว", status: "submitted" },
  ],
};

export const careerPath = [
  { title: "Sales Staff", level: "S1", state: "done", years: "2019–2021" },
  { title: "Senior Sales Staff", level: "S2", state: "done", years: "2021–2023" },
  { title: "Store Supervisor", level: "S3", state: "current", years: "2023–ปัจจุบัน" },
  { title: "Assistant Store Manager", level: "M1", state: "next", years: "เป้าหมาย 2027" },
  { title: "Store Manager", level: "M2", state: "future", years: "" },
  { title: "Area Manager", level: "M3", state: "future", years: "" },
] as const;

export const readiness = {
  target: "Assistant Store Manager",
  pct: 72,
  criteria: [
    { label: "อายุงานในตำแหน่งปัจจุบัน ≥ 24 เดือน", detail: "35 เดือน", ok: true },
    { label: "ผลประเมิน ≥ 4 ติดต่อกัน 2 ปี", detail: "2025: 4 · 2026 (Mid-year): 4", ok: true },
    { label: "หลักสูตรบังคับ: Leadership for Retail", detail: "ผ่านแล้ว ส.ค. 2026", ok: true },
    { label: "หลักสูตรบังคับ: Store P&L Management", detail: "ยังไม่ลงทะเบียน", ok: false },
    { label: "Competency ไม่มี Gap เกิน 1 ระดับ", detail: "Gap: P&L (−1.5)", ok: false },
  ],
};

export const lmsCourses = [
  { code: "RT-PNL-01", title: "การบริหารกำไร-ขาดทุนสาขา (Store P&L)", competency: "การบริหารกำไร-ขาดทุนสาขา", hours: 12, delivery: "Online", match: 96 },
  { code: "LD-COACH-02", title: "Coaching for Frontline Leaders", competency: "การสอนงานและพัฒนาทีม", hours: 14, delivery: "Classroom 2 วัน", match: 90 },
  { code: "DA-PBI-01", title: "Power BI สำหรับงานขายหน้าร้าน", competency: "การวิเคราะห์ข้อมูลการขาย", hours: 8, delivery: "Online", match: 84 },
];

export const internalJobs = [
  { title: "Assistant Store Manager", unit: "สาขาเมกาบางนา", close: "15 ธ.ค. 2026", match: 82 },
  { title: "Assistant Store Manager", unit: "สาขารังสิต", close: "31 ธ.ค. 2026", match: 78 },
];

export const idp = {
  aspiration: "ก้าวสู่ Assistant Store Manager ภายในปี 2027 และเป็น Store Manager ภายใน 3 ปี",
  approvedBy: "วิภาวดี ศรีสุข",
  actions: [
    { id: "a1", title: "รักษาการผู้จัดการสาขา ช่วงผู้จัดการลาพักร้อน 2 สัปดาห์", type: "experience", competency: "การบริหารงานสาขา", dueDate: "2026-12-20", status: "in_progress", progress: 60 },
    { id: "a2", title: "เป็นเจ้าของโครงการลด Shrinkage สาขาบางนา", type: "experience", competency: "การบริหารกำไร-ขาดทุนสาขา", dueDate: "2026-09-30", status: "completed", progress: 100, note: "Shrinkage ลดจาก 2.4% เหลือ 1.6%" },
    { id: "a3", title: "Mentoring รายเดือนกับ Area Manager", type: "exposure", competency: "ภาวะผู้นำ", dueDate: "2026-12-31", status: "in_progress", progress: 70, mentor: "ประเสริฐ มั่นคง" },
    { id: "a4", title: "ดูงานสาขาต้นแบบ (Flagship) 1 วัน", type: "exposure", competency: "การบริหารงานสาขา", dueDate: "2027-01-31", status: "not_started", progress: 0 },
    { id: "a5", title: "หลักสูตร Coaching for Frontline Leaders", type: "education", competency: "การสอนงานและพัฒนาทีม", dueDate: "2026-08-31", status: "completed", progress: 100, lmsCourse: "LD-COACH-02", note: "ผ่าน 92 คะแนน (sync จาก LMS)" },
    { id: "a6", title: "หลักสูตร Power BI สำหรับงานขายหน้าร้าน", type: "education", competency: "การวิเคราะห์ข้อมูลการขาย", dueDate: "2026-12-15", status: "in_progress", progress: 40, lmsCourse: "DA-PBI-01" },
  ] as IdpAction[],
};

export const team: TeamMember[] = [
  { ...people.t1, planStatus: "self_review", goals: 4, progress: 94, health: "on_track", lastCheckin: "2026-11-05", selfScore: 4.2, managerScore: null },
  { ...people.t2, planStatus: "self_review", goals: 4, progress: 81, health: "at_risk", lastCheckin: "2026-11-06", selfScore: 3.6, managerScore: null },
  { ...people.t3, planStatus: "manager_review", goals: 4, progress: 97, health: "on_track", lastCheckin: "2026-11-04", selfScore: 4.0, managerScore: 4.1 },
  { ...people.t4, planStatus: "self_review", goals: 4, progress: 72, health: "off_track", lastCheckin: "2026-09-12", selfScore: null, managerScore: null },
  { ...people.t5, planStatus: "manager_review", goals: 4, progress: 89, health: "on_track", lastCheckin: "2026-11-07", selfScore: 3.8, managerScore: null },
  { ...people.t6, planStatus: "self_review", goals: 5, progress: 91, health: "on_track", lastCheckin: "2026-10-30", selfScore: null, managerScore: null },
  { ...people.t7, planStatus: "manager_review", goals: 4, progress: 85, health: "at_risk", lastCheckin: "2026-11-02", selfScore: 3.4, managerScore: null },
  { ...people.t8, planStatus: "goal_pending", goals: 3, progress: 0, health: "no_goal", lastCheckin: null, selfScore: null, managerScore: null },
];

// Calibration: Retail เขตกรุงเทพฯ ตะวันออก (ตัวอย่าง 18 คน)
const calNames = [
  "สมชาย ใจดี", "อารีย์ พงษ์ไทย", "กิตติ ชัยมงคล", "ปวีณา สุขสม", "ธีระ วงศ์ทอง", "นันทนา ศรีเมือง",
  "วรวุฒิ แสนดี", "สุภาพร มีสุข", "ชาตรี บุญยืน", "ดารุณี ใจกล้า", "ปกรณ์ ทองดี", "รัชนี เพชรงาม",
  "อำนาจ ศรีวงศ์", "ลัดดา คงมั่น", "เอกชัย ทวีสุข", "พรทิพย์ แสงจันทร์", "ยุทธนา ชูใจ", "ศศิธร นิลสุวรรณ",
];
const calPos = ["Store Supervisor", "Store Manager", "Store Supervisor", "Asst. Store Manager", "Store Manager", "Store Supervisor"];
const calData: [1 | 2 | 3, 1 | 2 | 3, number, number][] = [
  [3, 3, 4, 4.4], [3, 3, 5, 4.7], [2, 3, 4, 3.9], [3, 2, 4, 4.2], [2, 2, 3, 3.4], [2, 2, 3, 3.3],
  [2, 2, 3, 3.2], [3, 2, 4, 4.1], [1, 2, 2, 2.6], [2, 1, 3, 3.0], [2, 3, 4, 3.8], [2, 2, 3, 3.5],
  [1, 1, 2, 2.3], [3, 1, 4, 4.0], [2, 2, 3, 3.1], [2, 1, 3, 2.9], [1, 3, 3, 2.9], [3, 3, 5, 4.6],
];
export const calibrationPeople: (Person & CalibrationEntry)[] = calNames.map((name, i) => ({
  id: `cal${i}`, personId: `cal${i}`, code: `E1${(3000 + i * 37).toString()}`, name,
  position: calPos[i % calPos.length], orgUnit: ["สาขาบางนา", "สาขาเมกาบางนา", "สาขาลาดกระบัง", "สาขาสุวรรณภูมิ"][i % 4],
  bu: "retail", color: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"][i % 7],
  performance: calData[i][0], potential: calData[i][1], preRating: calData[i][2], rating: calData[i][2], score: calData[i][3],
}));

export const nineBoxMeta: Record<number, { name: string; en: string; action: string; tone: string }> = {
  9: { name: "ดาวเด่น", en: "Star", action: "เตรียมเลื่อนตำแหน่ง · Succession", tone: "#d0f0de" },
  8: { name: "ดาวรุ่ง", en: "High Potential", action: "งานท้าทาย + Mentoring", tone: "#e3f3e9" },
  7: { name: "เพชรในตม", en: "Enigma", action: "หาสาเหตุ · Coaching ใกล้ชิด", tone: "#fff4dc" },
  6: { name: "ผลงานสูง", en: "High Performer", action: "ขยายบทบาท · รักษาตัว", tone: "#e3f3e9" },
  5: { name: "กำลังหลัก", en: "Core Player", action: "พัฒนาต่อเนื่องตาม IDP", tone: "#eef4fd" },
  4: { name: "ต้องพัฒนา", en: "Inconsistent", action: "ตั้งเป้าชัด · ติดตามรายเดือน", tone: "#fff4dc" },
  3: { name: "มืออาชีพ", en: "Trusted Pro", action: "ผู้เชี่ยวชาญ · ถ่ายทอดความรู้", tone: "#eef4fd" },
  2: { name: "ทำงานมั่นคง", en: "Effective", action: "รักษามาตรฐาน", tone: "#f3f5f8" },
  1: { name: "ต่ำกว่าเกณฑ์", en: "Risk", action: "แผนปรับปรุงผลงาน (PIP)", tone: "#fde9e9" },
};

export const ratingGuideline = { 5: 10, 4: 20, 3: 50, 2: 15, 1: 5 } as Record<number, number>;

// Analytics (ทั้งองค์กร)
export const analytics = {
  headcount: 11680,
  kpis: [
    { label: "ตั้งเป้าหมายครบ", value: 96, delta: +4, unit: "%" },
    { label: "Check-in สม่ำเสมอ (45 วัน)", value: 78, delta: +11, unit: "%" },
    { label: "ประเมินตนเองแล้ว", value: 64, delta: 0, unit: "%", note: "เหลือ 21 วัน" },
    { label: "มี IDP ที่อนุมัติแล้ว", value: 71, delta: +18, unit: "%" },
  ],
  byBU: [
    { bu: "สำนักงานใหญ่", key: "hq", headcount: 820, goal: 99, checkin: 86, self: 81, idp: 88 },
    { bu: "ค้าปลีก", key: "retail", headcount: 6450, goal: 96, checkin: 74, self: 58, idp: 66 },
    { bu: "FMCG", key: "fmcg", headcount: 1230, goal: 97, checkin: 82, self: 70, idp: 75 },
    { bu: "โรงงาน", key: "factory", headcount: 3180, goal: 94, checkin: 79, self: 66, idp: 72 },
  ],
  ratingDist: { 5: 9, 4: 27, 3: 48, 2: 12, 1: 4 } as Record<number, number>,
  checkinTrend: [52, 55, 61, 63, 66, 70, 68, 72, 74, 76, 78],
  months: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย."],
  nineBox: [
    { label: "ดาวเด่น / ดาวรุ่ง", value: 14 },
    { label: "กำลังหลัก / ผลงานสูง", value: 63 },
    { label: "ต้องพัฒนา / ต่ำกว่าเกณฑ์", value: 23 },
  ],
  skillGaps: [
    { name: "การวิเคราะห์ข้อมูล", gap: 1.3, people: 2140 },
    { name: "การสอนงานและพัฒนาทีม", gap: 1.1, people: 1460 },
    { name: "Lean / การลดความสูญเปล่า", gap: 0.9, people: 980 },
    { name: "การบริหารกำไร-ขาดทุนสาขา", gap: 0.9, people: 410 },
    { name: "ความปลอดภัยในการทำงาน", gap: 0.6, people: 720 },
  ],
  succession: { critical: 148, readyNow: 52, ready12: 61, none: 35 },
};

export const integrations: IntegrationSource[] = [
  { code: "core_hr", name: "Core HR", desc: "ข้อมูลพนักงาน · โครงสร้างองค์กร · ตำแหน่ง", direction: "inbound", schedule: "Real-time + ทุกคืน 02:00", lastSync: "วันนี้ 02:00", records24h: 11_742, failed24h: 0, pending: 0, status: "ok" },
  { code: "recruitment", name: "Recruitment", desc: "พนักงานใหม่ · ผล Assessment · ตำแหน่งว่าง", direction: "inbound", schedule: "Real-time (Webhook)", lastSync: "วันนี้ 10:42", records24h: 18, failed24h: 0, pending: 0, status: "ok" },
  { code: "lms", name: "LMS (Learning)", desc: "หลักสูตร · ผลการอบรม ⇄ ลงทะเบียนจาก IDP", direction: "both", schedule: "Real-time (Webhook)", lastSync: "วันนี้ 11:05", records24h: 1_264, failed24h: 3, pending: 2, status: "warning" },
  { code: "tna", name: "Time & Attendance", desc: "สรุปการมาทำงานรายเดือน: สาย ขาด ลา OT", direction: "inbound", schedule: "รายเดือน (วันที่ 3)", lastSync: "3 พ.ย. 2026", records24h: 0, failed24h: 0, pending: 0, status: "ok" },
  { code: "payroll", name: "Payroll & Compensation", desc: "ส่งผลประเมิน → Merit increase / โบนัส", direction: "outbound", schedule: "เมื่อปิดรอบ Calibration", lastSync: "15 ม.ค. 2026", records24h: 0, failed24h: 0, pending: 0, status: "ok" },
  { code: "pos", name: "POS (Retail)", desc: "ยอดขาย · สินค้าสูญหาย · สต็อก รายสาขา/รายคน", direction: "inbound", schedule: "รายวัน 23:00", lastSync: "เมื่อคืน 23:15", records24h: 48_310, failed24h: 0, pending: 0, status: "ok" },
  { code: "mes", name: "MES (Factory)", desc: "Output · Yield · Downtime · Safety ราย Line/กะ", direction: "inbound", schedule: "ทุกสิ้นกะ", lastSync: "วันนี้ 06:05", records24h: 2_196, failed24h: 0, pending: 0, status: "ok" },
  { code: "qms", name: "QMS (Quality)", desc: "Defect rate · Customer complaint · Audit", direction: "inbound", schedule: "รายวัน 01:00", lastSync: "เมื่อวาน 01:00", records24h: 0, failed24h: 1, pending: 0, status: "error" },
  { code: "internal_job", name: "Internal Job / Succession", desc: "ตำแหน่งว่างภายใน ⇄ Talent / 9-Box", direction: "both", schedule: "Real-time", lastSync: "วันนี้ 08:30", records24h: 12, failed24h: 0, pending: 0, status: "ok" },
];

export const todosByRole: Record<"employee" | "manager", Todo[]> = {
  employee: [
    { kind: "review", title: "ประเมินตนเอง (ปลายปี)", subtitle: "ครบกำหนด 15 ธ.ค. · เหลือ 21 วัน", link: "/review", urgent: true },
    { kind: "checkin", title: "นัด Check-in กับหัวหน้า", subtitle: "ศุกร์ 28 พ.ย. 2026", link: "/checkin" },
    { kind: "feedback", title: "มี Feedback ใหม่", subtitle: "2 รายการ", link: "/feedback" },
    { kind: "idp", title: "อัปเดตความคืบหน้า IDP", subtitle: "Power BI สำหรับงานขาย · 40%", link: "/idp" },
  ],
  manager: [
    { kind: "approve", title: "อนุมัติเป้าหมายลูกทีม", subtitle: "ณัฐพล (ทดลองงาน) · 3 ข้อ", link: "/team", urgent: true },
    { kind: "review", title: "ประเมินลูกทีม", subtitle: "3 / 8 คน ส่งประเมินตนเองแล้ว", link: "/team" },
    { kind: "checkin", title: "ลูกทีมไม่ได้ Check-in > 45 วัน", subtitle: "ธนวัฒน์ รุ่งเรือง", link: "/team", urgent: true },
    { kind: "review", title: "ประเมินตนเอง (ปลายปี)", subtitle: "ครบกำหนด 15 ธ.ค.", link: "/review" },
  ],
};
