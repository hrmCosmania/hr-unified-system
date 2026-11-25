import { useState } from "react";
import { MessagesSquare, Lightbulb, CalendarDays, Lock, Save } from "lucide-react";
import { useStore } from "../data/store";
import { team } from "../data/mock";
import { Avatar, Button, Card, CardTitle, Field, PageHeader, Progress, StatusPill, cx, thDate, toneOf } from "../components/ui";
import { progressOf } from "./Home";

const moods = [
  { v: 1, e: "😣", l: "หนักมาก" }, { v: 2, e: "😕", l: "ไม่ค่อยดี" }, { v: 3, e: "😐", l: "ปกติ" }, { v: 4, e: "🙂", l: "ดี" }, { v: 5, e: "😄", l: "ดีมาก" },
];
const questions = [
  { key: "wentWell", q: "1. เดือนนี้เป็นอย่างไรบ้าง? อะไรที่ทำได้ดี", ph: "เช่น ยอดขายเกินเป้า โปรโมชันได้ผล ลูกค้าชม…" },
  { key: "challenges", q: "2. ติดอะไรอยู่? อุปสรรคที่พบ", ph: "เช่น คนไม่พอช่วงเย็น ระบบสต็อกคลาดเคลื่อน…" },
  { key: "supportNeeded", q: "3. หัวหน้าช่วยอะไรได้บ้าง?", ph: "เช่น ขออนุมัติ Part-time, ขอคำแนะนำ…" },
  { key: "nextSteps", q: "4. สิ่งที่จะทำต่อไป (Action)", ph: "สิ่งที่ตกลงร่วมกัน + กำหนดเวลา" },
] as const;

export default function CheckinPage() {
  const { role, goals, checkins, addCheckin, toast, liveStatus, subject, managerOf } = useStore();
  const ready = liveStatus === "ready";
  const mgr = ready ? managerOf(subject) : null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const [withWho, setWithWho] = useState(role === "employee" ? "mgr" : "t2");
  const [date, setDate] = useState(ready ? todayIso : "2026-11-24");
  const [form, setForm] = useState({ wentWell: "", challenges: "", supportNeeded: "", nextSteps: "" });
  const [mood, setMood] = useState(4);
  const [nextDate, setNextDate] = useState(ready ? new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10) : "2026-12-22");
  const [privateNote, setPrivateNote] = useState("");
  const avg = Math.round(goals.reduce((s, g) => s + Math.min(100, progressOf(g)) * g.weight, 0) / 100);
  const risky = goals.filter((g) => g.status === "at_risk" || g.status === "off_track");
  const filled = Object.values(form).filter((v) => v.trim()).length;

  const save = () => {
    if (ready) {
      if (!mgr) { toast("พนักงานคนนี้ยังไม่มีหัวหน้างานในระบบ HR — กำหนดหัวหน้างานที่ฐานข้อมูลพนักงานก่อน", "crit"); return; }
      addCheckin({ date, withName: mgr.name, ...form, mood, progress: avg, nextDate });
      setForm({ wentWell: "", challenges: "", supportNeeded: "", nextSteps: "" });
      toast(`บันทึก Check-in ของ ${subject?.name ?? ""} แล้ว`);
      return;
    }
    addCheckin({ date, withName: role === "employee" ? "วิภาวดี ศรีสุข" : team.find((t) => t.id === withWho)?.name ?? "", ...form, mood, progress: avg, nextDate });
    setForm({ wentWell: "", challenges: "", supportNeeded: "", nextSteps: "" });
    toast("บันทึก Check-in แล้ว · แจ้งเตือนอีกฝ่ายทาง LINE");
  };

  return (
    <div>
      <PageHeader icon={<MessagesSquare size={22} />} title="Check-in / Coaching" subtitle="พูดคุยสั้น ๆ สม่ำเสมอ 15–30 นาที/เดือน — ติดตามความคืบหน้า แก้อุปสรรค และพัฒนาร่วมกัน" />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        <Card className="p-5">
          <CardTitle>บันทึกการคุย Check-in</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Field label="วันที่">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={ready ? "พนักงาน · หัวหน้างาน" : role === "employee" ? "คุยกับ" : "ลูกทีม"}>
              {ready ? (
                <div className={cx("input flex items-center gap-2 bg-canvas", !mgr && "border-crit")}>
                  {subject && <Avatar p={subject} size={22} />}
                  <span className="truncate">{subject?.name ?? "—"} · {mgr ? `หัวหน้า ${mgr.name}` : <span className="text-crit">ยังไม่มีหัวหน้างานในระบบ HR</span>}</span>
                </div>
              ) : role === "employee" ? (
                <div className="input flex items-center gap-2 bg-canvas"><Avatar p={{ name: "วิภาวดี", color: "#6250d6" }} size={22} />วิภาวดี ศรีสุข (Store Manager)</div>
              ) : (
                <select className="input" value={withWho} onChange={(e) => setWithWho(e.target.value)}>
                  {team.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.position}</option>)}
                </select>
              )}
            </Field>
          </div>

          <div className="rounded-xl bg-canvas p-4 mb-5">
            <div className="flex items-center justify-between text-sm mb-2"><span className="font-medium text-ink-2">ภาพรวมเป้าหมาย ณ วันนี้</span><b>{avg}%</b></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {goals.map((g) => (
                <div key={g.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="flex-1 truncate text-ink-2">{g.title}</span>
                  <Progress value={progressOf(g)} tone={toneOf(g.status)} className="w-20" height={6} />
                  <span className="w-9 text-right text-ink-3">{Math.round(progressOf(g))}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((q) => (
              <Field key={q.key} label={q.q}>
                <textarea className="input" rows={2} placeholder={q.ph} value={form[q.key]} onChange={(e) => setForm({ ...form, [q.key]: e.target.value })} />
              </Field>
            ))}
            <div>
              <span className="label">ความรู้สึกต่องานในเดือนนี้</span>
              <div className="flex gap-2">
                {moods.map((m) => (
                  <button key={m.v} type="button" onClick={() => setMood(m.v)} aria-pressed={mood === m.v}
                    className={cx("flex-1 max-w-[84px] rounded-xl border py-2 flex flex-col items-center cursor-pointer transition-all",
                      mood === m.v ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-line hover:border-brand-200")}>
                    <span className="text-2xl">{m.e}</span><span className="text-[11px] text-ink-3 mt-0.5">{m.l}</span>
                  </button>
                ))}
              </div>
            </div>
            {role !== "employee" && !ready && (
              <Field label="บันทึกส่วนตัวของหัวหน้า" hint="มองเห็นเฉพาะคุณ (แยกตาราง + RLS) ไม่แสดงต่อพนักงาน">
                <div className="relative"><Lock size={14} className="absolute right-3 top-3 text-ink-3" />
                  <textarea className="input" rows={2} value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} /></div>
              </Field>
            )}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between pt-1">
              <Field label="นัด Check-in ครั้งถัดไป"><input type="date" className="input sm:w-48" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
              <div className="flex-1 sm:max-w-[220px]">
                <div className="flex justify-between text-xs text-ink-3 mb-1"><span>กรอกแล้ว</span><span>{filled}/4</span></div>
                <Progress value={(filled / 4) * 100} tone="leaf" height={6} />
              </div>
              <Button onClick={save} disabled={filled < 2}><Save size={16} />บันทึกการคุย</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <CardTitle icon={<Lightbulb size={16} className="text-[#eda100]" />}>หัวข้อแนะนำสำหรับการคุยครั้งนี้</CardTitle>
            <ul className="space-y-2.5 text-sm">
              {risky.map((g) => (
                <li key={g.id} className="flex gap-2 items-start"><StatusPill status={g.status} /><span className="text-ink-2">{g.title} — {Math.round(progressOf(g))}% ของเป้า</span></li>
              ))}
              {checkins[0]?.nextSteps && <li className="flex gap-2 text-ink-2">💬 ติดตาม Action จากครั้งก่อน: “{checkins[0].nextSteps}”</li>}
              {!ready && <li className="flex gap-2 text-ink-2">🎯 IDP: หลักสูตร Power BI ความคืบหน้า 40%</li>}
              {ready && !risky.length && !checkins.length && <li className="text-ink-3">ยังไม่มีประวัติ — เริ่มจากทบทวนเป้าหมายและอุปสรรคของเดือนนี้</li>}
            </ul>
          </Card>

          <Card className="p-5">
            <CardTitle icon={<CalendarDays size={16} className="text-brand-600" />}>ประวัติ Check-in</CardTitle>
            {checkins.length === 0 && <p className="text-sm text-ink-3">ยังไม่มีการบันทึก Check-in</p>}
            <ol className="relative border-l-2 border-line ml-2 space-y-5">
              {checkins.map((c) => (
                <li key={c.id} className="ml-4">
                  <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-leaf-500 ring-4 ring-white" />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{thDate(c.date)}</p>
                    <span className="text-lg" title={moods[c.mood - 1].l}>{moods[c.mood - 1].e}</span>
                  </div>
                  <p className="text-xs text-ink-3">กับ {c.withName} · ความคืบหน้า {c.progress}%</p>
                  <p className="text-[13px] text-ink-2 mt-1.5 line-clamp-2"><b className="text-[#087a08]">ดี:</b> {c.wentWell}</p>
                  <p className="text-[13px] text-ink-2 line-clamp-2"><b className="text-warn">อุปสรรค:</b> {c.challenges}</p>
                  <p className="text-[13px] text-ink-2 line-clamp-2"><b className="text-brand-700">ต่อไป:</b> {c.nextSteps}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
