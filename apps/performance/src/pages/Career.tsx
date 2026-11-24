import { useState } from "react";
import { Route, CircleCheck, CircleDashed, BookOpen, Briefcase, Flag, Plus, Store, Factory, ShoppingCart } from "lucide-react";
import { useStore } from "../data/store";
import { careerPath, competencies, internalJobs, lmsCourses, readiness } from "../data/mock";
import { Button, Card, CardTitle, PageHeader, Segmented, cx } from "../components/ui";
import { Ring } from "../components/charts";

const otherPaths = {
  factory: ["Operator", "Senior Operator", "Line Leader", "Production Supervisor", "Production Manager", "Plant Manager"],
  fmcg: ["Sales Representative", "Key Account Executive", "Key Account Manager", "Channel Manager", "Sales Director"],
};

export default function Career() {
  const { addIdpAction, toast } = useStore();
  const [path, setPath] = useState<"retail" | "factory" | "fmcg">("retail");
  const [enrolled, setEnrolled] = useState<string[]>([]);

  return (
    <div>
      <PageHeader icon={<Route size={22} />} title="Competency & Career Path" subtitle="เห็นเส้นทางเติบโตชัดเจน รู้ว่าต้องพัฒนาอะไร และมีหลักสูตรรองรับจาก LMS"
        actions={<Segmented value={path} onChange={setPath} items={[
          { value: "retail", label: <span className="inline-flex items-center gap-1"><Store size={14} />ค้าปลีก</span> },
          { value: "factory", label: <span className="inline-flex items-center gap-1"><Factory size={14} />โรงงาน</span> },
          { value: "fmcg", label: <span className="inline-flex items-center gap-1"><ShoppingCart size={14} />FMCG</span> },
        ]} />} />

      {/* Path */}
      <Card className="p-5 mb-5">
        <CardTitle action={<span className="text-xs text-ink-3">{path === "retail" ? "สายงานปฏิบัติการสาขา (Retail Operations)" : path === "factory" ? "สายงานการผลิต (Production)" : "สายงานขาย FMCG"}</span>}>เส้นทางความก้าวหน้าในสายงาน</CardTitle>
        <div className="overflow-x-auto pb-2">
          <ol className="flex min-w-[720px]">
            {(path === "retail" ? careerPath : otherPaths[path].map((t, i) => ({ title: t, level: "", state: i === 0 ? "future" : "future", years: "" }))).map((s, i, arr) => (
              <li key={s.title} className="flex-1 flex flex-col items-center relative text-center">
                {i > 0 && <span className={cx("absolute top-6 right-1/2 w-full h-1 rounded", s.state === "done" || s.state === "current" ? "bg-leaf-500" : "bg-[#dfe7f1]")} />}
                <span className={cx("relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-4 text-sm font-semibold",
                  s.state === "done" && "bg-leaf-500 border-leaf-500 text-white",
                  s.state === "current" && "bg-navy-800 border-[#cfe0f6] text-white ring-4 ring-brand-100",
                  s.state === "next" && "bg-white border-leaf-500 text-leaf-600 border-dashed",
                  s.state === "future" && "bg-white border-[#dfe7f1] text-ink-3")}>
                  {s.state === "done" ? <CircleCheck size={20} /> : s.state === "next" ? <Flag size={18} /> : i + 1}
                </span>
                <span className={cx("mt-2 text-[13px] leading-tight px-1", s.state === "current" ? "font-semibold text-navy-800" : "text-ink-2")}>{s.title}</span>
                {s.state === "current" && <span className="text-[11px] mt-1 rounded-full bg-navy-800 text-white px-2">ปัจจุบัน</span>}
                {s.state === "next" && <span className="text-[11px] mt-1 rounded-full bg-leaf-50 text-leaf-600 px-2">ตำแหน่งถัดไป</span>}
                {s.years && s.state !== "current" && s.state !== "next" && <span className="text-[11px] text-ink-3 mt-0.5">{s.years}</span>}
                {i === arr.length - 1 && null}
              </li>
            ))}
          </ol>
        </div>
        {path !== "retail" && <p className="text-xs text-ink-3 mt-2">💡 สนใจย้ายสายงาน? ระบบจะเทียบ Competency ของคุณกับตำแหน่งในสายงานอื่น และแนะนำตำแหน่งว่างภายใน (Internal Job)</p>}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
        <Card className="p-5">
          <CardTitle>ความพร้อมสู่ {readiness.target}</CardTitle>
          <div className="flex justify-center my-2">
            <Ring value={readiness.pct} size={150} thickness={14}>
              <span className="font-display text-[34px] font-semibold text-navy-800 leading-none">{readiness.pct}%</span>
              <span className="text-xs text-ink-3 mt-1">ความพร้อม</span>
            </Ring>
          </div>
          <ul className="mt-4 space-y-2.5">
            {readiness.criteria.map((c) => (
              <li key={c.label} className="flex gap-2.5 text-sm">
                {c.ok ? <CircleCheck size={18} className="text-good shrink-0" /> : <CircleDashed size={18} className="text-warn shrink-0" />}
                <span><span className="text-ink">{c.label}</span><span className="block text-xs text-ink-3">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <CardTitle action={<span className="text-xs text-ink-3">ระดับ 1–5 · เทียบกับตำแหน่ง Assistant Store Manager</span>}>Competency Gap Analysis</CardTitle>
          <div className="flex gap-4 text-xs text-ink-2 mb-3">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-500" />ระดับปัจจุบัน</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-3.5 bg-navy-800" />ระดับที่ต้องการ</span>
          </div>
          <ul className="space-y-3">
            {competencies.map((c) => {
              const gap = c.required - c.current;
              return (
                <li key={c.id} className="grid grid-cols-[150px_1fr_70px] sm:grid-cols-[200px_1fr_90px] items-center gap-3 text-sm">
                  <span className="truncate text-ink-2" title={c.name}>{c.name}</span>
                  <div className="relative h-5 rounded-md bg-[#eef2f7]">
                    <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${(c.current / 5) * 100}%`, background: gap > 1 ? "#ec835a" : gap > 0 ? "#fab219" : "#2a78d6" }} />
                    <div className="absolute -top-1 -bottom-1 w-0.5 bg-navy-800" style={{ left: `${(c.required / 5) * 100}%` }} />
                    {[1, 2, 3, 4].map((t) => <span key={t} className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${t * 20}%` }} />)}
                  </div>
                  <span className={cx("text-right text-xs font-semibold", gap > 1 ? "text-crit" : gap > 0 ? "text-warn" : "text-[#087a08]")}>
                    {gap > 0 ? `▲ ขาด ${gap.toFixed(1)}` : "✓ ผ่าน"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5 xl:col-span-2">
          <CardTitle icon={<BookOpen size={16} className="text-brand-600" />} action={<span className="text-xs text-ink-3">จาก LMS · เรียงตามความเหมาะสมกับ Gap</span>}>หลักสูตรแนะนำ</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {lmsCourses.map((c) => {
              const on = enrolled.includes(c.code);
              return (
                <div key={c.code} className="rounded-xl border border-line p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono text-ink-3">{c.code}</span>
                    <span className="text-[11px] rounded-full bg-leaf-50 text-leaf-600 px-2 py-0.5 font-medium">ตรง Gap {c.match}%</span>
                  </div>
                  <p className="font-medium mt-1.5">{c.title}</p>
                  <p className="text-xs text-ink-3 mt-1">พัฒนา: {c.competency}</p>
                  <p className="text-xs text-ink-3">{c.delivery} · {c.hours} ชม.</p>
                  <Button size="sm" variant={on ? "ghost" : "secondary"} className="mt-3 self-start" disabled={on}
                    onClick={() => {
                      setEnrolled([...enrolled, c.code]);
                      addIdpAction({ title: `หลักสูตร ${c.title}`, type: "education", competency: c.competency, dueDate: "2027-02-28", status: "not_started", progress: 0, lmsCourse: c.code });
                      toast("เพิ่มใน IDP และส่งคำขอลงทะเบียนไปยัง LMS แล้ว");
                    }}>
                    {on ? <><CircleCheck size={14} />เพิ่มใน IDP แล้ว</> : <><Plus size={14} />เพิ่มใน IDP + ลงทะเบียน</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-2">
          <CardTitle icon={<Briefcase size={16} className="text-brand-600" />} action={<span className="text-xs text-ink-3">จากระบบ Internal Job</span>}>ตำแหน่งว่างภายในที่เหมาะกับคุณ</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {internalJobs.map((j) => (
              <div key={j.unit} className="flex items-center gap-4 rounded-xl border border-line p-4">
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><Store size={20} /></div>
                <div className="flex-1 min-w-0"><p className="font-medium">{j.title}</p><p className="text-xs text-ink-3">{j.unit} · ปิดรับ {j.close}</p></div>
                <div className="text-right"><p className="font-display font-semibold text-leaf-600">{j.match}%</p><p className="text-[11px] text-ink-3">ความเหมาะสม</p></div>
                <Button size="sm" variant="secondary" onClick={() => toast("แจ้งความสนใจไปยัง HR และหัวหน้าแล้ว", "info")}>สนใจ</Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
