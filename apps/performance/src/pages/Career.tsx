import { useEffect, useState } from "react";
import * as liveApi from "../data/live";
import type { LiveCareer, LiveCourse, LiveJob } from "../data/live";
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
  const { liveStatus } = useStore();
  if (liveStatus === "ready") return <LiveCareerPage />;
  return <DemoCareer />;
}

function DemoCareer() {
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

/* ===================== ข้อมูลจริง ===================== */
function LiveCareerPage() {
  const { subject, cycle, posComps, addIdpAction, idpActions, toast } = useStore();
  const [career, setCareer] = useState<LiveCareer | null>(null);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [courses, setCourses] = useState<LiveCourse[]>([]);
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [q, setQ] = useState("");
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e), "crit");
  useEffect(() => {
    setCareer(null); setLevels({});
    if (subject?.positionId) liveApi.loadCareer(subject.positionId).then(setCareer, fail);
    if (subject && cycle) liveApi.loadCompetencyLevels(cycle.id, subject.id).then(setLevels, () => setLevels({}));
  }, [subject?.id, cycle?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { liveApi.loadTrainingCourses().then(setCourses, fail); liveApi.loadInternalJobs().then(setJobs, fail); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inIdp = new Set(idpActions.map((a) => a.title));
  const rated = posComps.filter((c) => levels[c.code] != null);
  const met = rated.filter((c) => levels[c.code] >= c.required).length;
  const shown = courses.filter((c) => !q || c.title.includes(q) || c.category.includes(q)).slice(0, 12);

  return (
    <div>
      <PageHeader icon={<Route size={22} />} title="Competency & Career Path" subtitle={`${subject?.name ?? ""} · เส้นทางอาชีพจาก JD · หลักสูตรจากแอปฝึกอบรม · ตำแหน่งว่างจากระบบสรรหา (ข้อมูลกลาง)`} />

      <Card className="p-5 mb-5">
        <CardTitle>เส้นทางความก้าวหน้า</CardTitle>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 rounded-xl bg-navy-800 text-white p-4"><p className="text-xs opacity-70">ตำแหน่งปัจจุบัน</p><p className="font-display font-semibold text-lg">{subject?.position || "-"}</p><p className="text-xs opacity-70">{subject?.positionCode}</p></div>
          <Flag size={22} className="text-leaf-600 self-center rotate-0" />
          <div className="flex-1 rounded-xl border-2 border-dashed border-leaf-500 p-4"><p className="text-xs text-ink-3">ตำแหน่งถัดไป (ตาม JD)</p><p className="font-display font-semibold text-lg text-navy-800">{career?.next || "ยังไม่ได้กำหนดใน JD"}</p>{career?.timeline && <p className="text-xs text-ink-3">ระยะเวลา: {career.timeline}</p>}</div>
        </div>
        {career?.criteria && <p className="text-sm text-ink-2 mt-3 rounded-lg bg-canvas px-3 py-2"><b>เกณฑ์การเลื่อน:</b> {career.criteria}</p>}
        {!career && <p className="text-xs text-ink-3 mt-3">กำหนดเส้นทางอาชีพได้ที่ JD ของตำแหน่ง (ระบบ HR หลัก › ตั้งค่าองค์กร › การจัดการตำแหน่งงาน)</p>}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
        <Card className="p-5">
          <CardTitle>Competency ที่ถึงระดับที่ต้องการ</CardTitle>
          <div className="flex justify-center my-2">
            <Ring value={rated.length ? Math.round((met / posComps.length) * 100) : 0} size={150} thickness={14}>
              <span className="font-display text-[34px] font-semibold text-navy-800 leading-none">{rated.length ? `${met}/${posComps.length}` : "–"}</span>
              <span className="text-xs text-ink-3 mt-1">{rated.length ? "ผ่านระดับที่ต้องการ" : "ยังไม่มีผลประเมิน"}</span>
            </Ring>
          </div>
          <p className="text-xs text-ink-3 text-center">ระดับปัจจุบันมาจากแบบประเมินรอบนี้ (หัวหน้า หรือประเมินตนเอง)</p>
        </Card>

        <Card className="p-5">
          <CardTitle action={<span className="text-xs text-ink-3">ระดับ 1–5 · เทียบกับตำแหน่ง {subject?.position}</span>}>Competency Gap Analysis</CardTitle>
          {posComps.length === 0 ? <p className="text-sm text-ink-3">ตำแหน่งนี้ยังไม่มี Competency ในระบบ HR หลัก</p> : <>
          <div className="flex gap-4 text-xs text-ink-2 mb-3">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-500" />ระดับปัจจุบัน</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-3.5 bg-navy-800" />ระดับที่ต้องการ</span>
          </div>
          <ul className="space-y-3">
            {posComps.map((c) => { const cur = levels[c.code]; const gap = cur == null ? null : c.required - cur;
              return (
                <li key={c.id} className="grid grid-cols-[150px_1fr_90px] sm:grid-cols-[220px_1fr_100px] items-center gap-3 text-sm">
                  <span className="truncate text-ink-2" title={c.name}>{c.name}</span>
                  <div className="relative h-5 rounded-md bg-[#eef2f7]">
                    {cur != null && <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${(cur / 5) * 100}%`, background: gap! > 1 ? "#ec835a" : gap! > 0 ? "#fab219" : "#2a78d6" }} />}
                    <div className="absolute -top-1 -bottom-1 w-0.5 bg-navy-800" style={{ left: `${(c.required / 5) * 100}%` }} />
                  </div>
                  <span className={cx("text-right text-xs font-semibold", gap == null ? "text-ink-3" : gap > 1 ? "text-crit" : gap > 0 ? "text-warn" : "text-[#087a08]")}>
                    {gap == null ? `ต้องการ ${c.required}` : gap > 0 ? `▲ ขาด ${gap}` : "✓ ผ่าน"}</span>
                </li>); })}
          </ul></>}
        </Card>

        <Card className="p-5 xl:col-span-2">
          <CardTitle icon={<BookOpen size={16} className="text-brand-600" />} action={<input className="input h-9 py-1 w-52" placeholder="ค้นหาหลักสูตร" value={q} onChange={(e) => setQ(e.target.value)} />}>หลักสูตรจากแอปฝึกอบรม</CardTitle>
          {shown.length === 0 && <p className="text-sm text-ink-3">ยังไม่มีหลักสูตรที่เผยแพร่ในแอปฝึกอบรม</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {shown.map((c) => { const t = `หลักสูตร ${c.title}`, on = inIdp.has(t); return (
              <div key={c.id} className="rounded-xl border border-line p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2"><span className="text-[11px] font-mono text-ink-3">{c.code}</span>{c.nextDate && <span className="text-[11px] rounded-full bg-leaf-50 text-leaf-600 px-2 py-0.5 font-medium">รอบถัดไป {new Date(c.nextDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>}</div>
                <p className="font-medium mt-1.5">{c.title}</p>
                <p className="text-xs text-ink-3 mt-1">{c.category} · {c.hours} ชม.</p>
                <Button size="sm" variant={on ? "ghost" : "secondary"} className="mt-3 self-start" disabled={on}
                  onClick={() => addIdpAction({ title: t, type: "education", competency: "", dueDate: c.nextDate ?? new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), status: "not_started", progress: 0, lmsCourse: c.code })}>
                  {on ? <><CircleCheck size={14} />อยู่ใน IDP แล้ว</> : <><Plus size={14} />เพิ่มใน IDP</>}
                </Button>
              </div>); })}
          </div>
          <p className="text-xs text-ink-3 mt-3">ลงทะเบียนเข้าอบรมได้ที่แอปฝึกอบรม · <a className="text-brand-600 hover:underline" href="/training/">เปิดแอปฝึกอบรม ↗</a></p>
        </Card>

        <Card className="p-5 xl:col-span-2">
          <CardTitle icon={<Briefcase size={16} className="text-brand-600" />} action={<span className="text-xs text-ink-3">จากใบขออัตรากำลังในระบบสรรหา</span>}>ตำแหน่งว่างภายใน</CardTitle>
          {jobs.length === 0 && <p className="text-sm text-ink-3">ยังไม่มีตำแหน่งที่เปิดรับ</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center gap-4 rounded-xl border border-line p-4">
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><Briefcase size={20} /></div>
                <div className="flex-1 min-w-0"><p className="font-medium">{j.title}</p><p className="text-xs text-ink-3">{j.unit || "-"}{j.close ? ` · ปิดรับ ${new Date(j.close).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}` : ""}</p></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
