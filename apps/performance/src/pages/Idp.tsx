import { useState } from "react";
import { GraduationCap, Plus, Briefcase, Users, BookOpen, Database, CircleCheck, Compass } from "lucide-react";
import { useStore } from "../data/store";
import { competencies, idp } from "../data/mock";
import { Button, Card, CardTitle, Field, Modal, PageHeader, Progress, StatusPill, cx, thDate } from "../components/ui";
import { Donut } from "../components/charts";
import type { IdpAction } from "../data/types";

const typeMeta = {
  experience: { label: "เรียนรู้จากงานจริง", pct: "70%", icon: <Briefcase size={16} />, color: "#2a78d6", hint: "งานท้าทาย, รักษาการ, โครงการ" },
  exposure: { label: "เรียนรู้จากผู้อื่น", pct: "20%", icon: <Users size={16} />, color: "#eb6834", hint: "Mentoring, Coaching, ดูงาน" },
  education: { label: "การอบรม / หลักสูตร", pct: "10%", icon: <BookOpen size={16} />, color: "#1baf7a", hint: "LMS, Classroom, E-learning" },
} as const;

export default function Idp() {
  const { idpActions, addIdpAction, updateIdpAction, toast } = useStore();
  const [open, setOpen] = useState(false);
  const done = idpActions.filter((a) => a.status === "completed").length;
  const overall = Math.round(idpActions.reduce((s, a) => s + a.progress, 0) / Math.max(1, idpActions.length));

  return (
    <div>
      <PageHeader icon={<GraduationCap size={22} />} title="แผนพัฒนารายบุคคล (IDP)" subtitle="หลัก 70 : 20 : 10 · เชื่อมกับ LMS อัตโนมัติ — เรียนจบแล้วสถานะอัปเดตเอง"
        actions={<Button onClick={() => setOpen(true)}><Plus size={16} />เพิ่มแผนพัฒนา</Button>} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 mb-5">
        <Card className="p-5 bg-gradient-to-br from-white to-brand-50/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-800 text-white flex items-center justify-center shrink-0"><Compass size={20} /></div>
            <div className="flex-1">
              <p className="text-xs text-ink-3">เป้าหมายอาชีพของฉัน</p>
              <p className="font-display font-semibold text-navy-800 text-[17px] mt-0.5">{idp.aspiration}</p>
              <p className="text-xs text-ink-3 mt-2 inline-flex items-center gap-1"><CircleCheck size={13} className="text-good" />อนุมัติโดย {idp.approvedBy} · 12 ก.พ. 2026</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl bg-white border border-line p-3"><p className="text-xs text-ink-3">ความคืบหน้ารวม</p><p className="font-display text-2xl font-semibold text-navy-800">{overall}%</p></div>
            <div className="rounded-xl bg-white border border-line p-3"><p className="text-xs text-ink-3">สำเร็จแล้ว</p><p className="font-display text-2xl font-semibold text-navy-800">{done}/{idpActions.length}</p></div>
            <div className="rounded-xl bg-white border border-line p-3"><p className="text-xs text-ink-3">ชั่วโมงอบรม (LMS)</p><p className="font-display text-2xl font-semibold text-navy-800">22</p></div>
          </div>
        </Card>
        <Card className="p-5">
          <CardTitle>สัดส่วนกิจกรรม 70 : 20 : 10</CardTitle>
          <div className="flex items-center gap-4">
            <Donut size={112} thickness={14} segments={(Object.keys(typeMeta) as (keyof typeof typeMeta)[]).map((k) => ({ label: typeMeta[k].label, value: idpActions.filter((a) => a.type === k).length, color: typeMeta[k].color }))}
              center={<span className="text-xs text-ink-3">{idpActions.length} กิจกรรม</span>} />
            <ul className="text-[13px] space-y-2 flex-1">
              {(Object.keys(typeMeta) as (keyof typeof typeMeta)[]).map((k) => (
                <li key={k} className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: typeMeta[k].color }} />
                  <span className="flex-1 text-ink-2">{typeMeta[k].label}</span><b>{idpActions.filter((a) => a.type === k).length}</b></li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {(Object.keys(typeMeta) as (keyof typeof typeMeta)[]).map((k) => (
          <section key={k}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: typeMeta[k].color }}>{typeMeta[k].icon}</span>
              <div><h2 className="font-display font-semibold text-navy-800 text-[15px]">{typeMeta[k].pct} · {typeMeta[k].label}</h2><p className="text-xs text-ink-3">{typeMeta[k].hint}</p></div>
            </div>
            <div className="space-y-3">
              {idpActions.filter((a) => a.type === k).map((a) => <ActionCard key={a.id} a={a} onProgress={(v) => updateIdpAction(a.id, { progress: v, status: v >= 100 ? "completed" : v > 0 ? "in_progress" : "not_started" })} />)}
            </div>
          </section>
        ))}
      </div>

      <AddModal open={open} onClose={() => setOpen(false)} onSave={(a) => { addIdpAction(a); setOpen(false); toast(a.lmsCourse ? "เพิ่มแผนและส่งคำขอลงทะเบียนไป LMS แล้ว" : "เพิ่มแผนพัฒนาแล้ว"); }} />
    </div>
  );
}

function ActionCard({ a, onProgress }: { a: IdpAction; onProgress: (v: number) => void }) {
  return (
    <Card className={cx("p-4", a.status === "completed" && "bg-[#fbfdfb]")}>
      <div className="flex items-start justify-between gap-2">
        <p className={cx("font-medium text-[14px]", a.status === "completed" && "text-ink-2")}>{a.title}</p>
        <StatusPill status={a.status} />
      </div>
      <p className="text-xs text-ink-3 mt-1">#{a.competency} · กำหนด {thDate(a.dueDate)}</p>
      {a.mentor && <p className="text-xs text-ink-3">Mentor: {a.mentor}</p>}
      {a.lmsCourse && <p className="text-[11.5px] text-brand-700 mt-1 inline-flex items-center gap-1"><Database size={11} />LMS · {a.lmsCourse}</p>}
      {a.note && <p className="text-[12.5px] text-[#087a08] mt-1.5">✓ {a.note}</p>}
      <div className="flex items-center gap-3 mt-3">
        <Progress value={a.progress} tone={a.status === "completed" ? "good" : "brand"} height={6} />
        <span className="text-xs text-ink-2 w-9 text-right">{a.progress}%</span>
      </div>
      {a.status !== "completed" && !a.lmsCourse && (
        <input type="range" min={0} max={100} step={10} value={a.progress} onChange={(e) => onProgress(Number(e.target.value))}
          className="w-full mt-2 accent-[#1f5fbf]" aria-label="ปรับความคืบหน้า" />
      )}
    </Card>
  );
}

function AddModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (a: Omit<IdpAction, "id">) => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<IdpAction["type"]>("experience");
  const [comp, setComp] = useState(competencies[6].name);
  const [due, setDue] = useState("2027-03-31");
  return (
    <Modal open={open} onClose={onClose} title="เพิ่มแผนพัฒนา" footer={<>
      <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
      <Button disabled={!title.trim()} onClick={() => { onSave({ title, type, competency: comp, dueDate: due, status: "not_started", progress: 0 }); setTitle(""); }}>บันทึก</Button>
    </>}>
      <div className="space-y-4">
        <div>
          <span className="label">ประเภทกิจกรรม</span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(typeMeta) as IdpAction["type"][]).map((k) => (
              <button key={k} type="button" onClick={() => setType(k)}
                className={cx("rounded-xl border p-3 text-left cursor-pointer", type === k ? "border-brand-500 bg-brand-50" : "border-line")}>
                <span className="text-xs font-semibold" style={{ color: typeMeta[k].color }}>{typeMeta[k].pct}</span>
                <span className="block text-[13px] font-medium mt-0.5">{typeMeta[k].label}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="Competency ที่ต้องการพัฒนา">
          <select className="input" value={comp} onChange={(e) => setComp(e.target.value)}>
            {competencies.map((c) => <option key={c.id}>{c.name} (ขาด {Math.max(0, c.required - c.current).toFixed(1)})</option>)}
          </select>
        </Field>
        <Field label="กิจกรรม / สิ่งที่จะทำ"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น รับผิดชอบทำงบประมาณสาขาไตรมาส 1" /></Field>
        <Field label="กำหนดเสร็จ"><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
