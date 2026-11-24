import { useMemo, useState } from "react";
import { ClipboardCheck, Save, Send, Database, Sparkles } from "lucide-react";
import { useStore } from "../data/store";
import { competencies, team } from "../data/mock";
import { Avatar, Button, Card, CardTitle, Field, PageHeader, RatingPicker, Segmented, SourceTag, Stepper, cx, fmtCompact } from "../components/ui";
import { progressOf } from "./Home";

const ratingLabel = ["", "ต่ำกว่ามาตรฐาน", "ต้องพัฒนา", "ตามความคาดหวัง", "เกินความคาดหวัง", "โดดเด่น"];
const bandScore = (p: number) => (p >= 115 ? 5 : p >= 105 ? 4 : p >= 95 ? 3 : p >= 80 ? 2 : 1);
const KPI_W = 60, COMP_W = 40;

export default function Review() {
  const { role, goals, toast } = useStore();
  const [mode, setMode] = useState<"self" | "manager">(role === "employee" ? "self" : "manager");
  const [subject, setSubject] = useState("t3");
  const [kpiR, setKpiR] = useState<Record<string, number>>(() => Object.fromEntries(goals.map((g) => [g.id, bandScore(progressOf(g))])));
  const [compR, setCompR] = useState<Record<string, number>>({ k1: 5, k2: 4, k3: 4, k4: 3 });
  const [submitted, setSubmitted] = useState(false);
  const [strength, setStrength] = useState("");
  const [improve, setImprove] = useState("");

  const kpiScore = useMemo(() => {
    const w = goals.reduce((s, g) => s + (kpiR[g.id] ? g.weight : 0), 0);
    return w ? goals.reduce((s, g) => s + (kpiR[g.id] ?? 0) * g.weight, 0) / w : 0;
  }, [goals, kpiR]);
  const compVals = competencies.map((c) => compR[c.id]).filter(Boolean);
  const compScore = compVals.length ? compVals.reduce((a, b) => a + b, 0) / compVals.length : 0;
  const overall = (kpiScore * KPI_W + compScore * COMP_W) / 100;
  const doneCount = Object.keys(kpiR).length + compVals.length;
  const total = goals.length + competencies.length;
  const sub = team.find((t) => t.id === subject)!;
  const selfOf = (id: string) => ({ g1: 4, g2: 4, g3: 2, g4: 3, g5: 2, k1: 5, k2: 4, k3: 5, k4: 3, k5: 4, k6: 4, k7: 3, k8: 3 } as Record<string, number>)[id];

  return (
    <div>
      <PageHeader icon={<ClipboardCheck size={22} />} title="แบบประเมินผลงานปลายปี 2026"
        subtitle={`KPI ${KPI_W}% + Competency ${COMP_W}% · ครบกำหนด 15 ธ.ค. 2026`}
        actions={role !== "employee" ? <Segmented value={mode} onChange={setMode} items={[{ value: "self", label: "ประเมินตนเอง" }, { value: "manager", label: "ประเมินลูกทีม" }]} /> : undefined} />

      <Card className="p-5 mb-5">
        <Stepper current={submitted ? 1 : 0} steps={mode === "self"
          ? [{ label: "ประเมินตนเอง", sub: "ถึง 5 ธ.ค." }, { label: "หัวหน้าประเมิน", sub: "ถึง 15 ธ.ค." }, { label: "Calibration", sub: "16–23 ธ.ค." }, { label: "แจ้งผล & รับทราบ", sub: "ม.ค. 2027" }]
          : [{ label: "ลูกทีมประเมินตนเอง" }, { label: "หัวหน้าประเมิน" }, { label: "Calibration" }, { label: "แจ้งผล" }].map((s, i) => ({ ...s, sub: i === 1 ? "คุณอยู่ที่นี่" : undefined }))} />
      </Card>

      {mode === "manager" && (
        <Card className="p-4 mb-5 flex flex-wrap items-center gap-4">
          <Avatar p={sub} size={44} />
          <div className="flex-1 min-w-[180px]"><p className="font-semibold">{sub.name}</p><p className="text-sm text-ink-3">{sub.position} · {sub.orgUnit} · ประเมินตนเอง {sub.selfScore ?? "–"}</p></div>
          <select className="input w-auto" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {team.filter((t) => t.planStatus === "manager_review").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="space-y-5">
          {/* KPI */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5"><CardTitle action={<span className="text-xs text-ink-3">น้ำหนัก {KPI_W}%</span>}>ส่วนที่ 1 · ผลงานตามเป้าหมาย (KPI)</CardTitle></div>
            <div className="divide-y divide-line">
              {goals.map((g) => {
                const p = progressOf(g), sug = bandScore(p);
                return (
                  <div key={g.id} className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[14.5px]">{g.title} <span className="text-xs text-ink-3 font-normal">· {g.weight}%</span></p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-ink-3">
                        <SourceTag source={g.source} />
                        <span>ผลจริง {g.unit === "บาท" ? fmtCompact(g.actual ?? 0) : g.actual} / {g.unit === "บาท" ? fmtCompact(g.target) : g.target} {g.unit !== "บาท" && g.unit} = <b className="text-ink-2">{Math.round(p)}%</b></span>
                        <span className="inline-flex items-center gap-1 text-brand-700"><Database size={11} />ระบบแนะนำ {sug}</span>
                      </div>
                      <input className="input mt-2 text-[13px] py-1.5" placeholder="ความคิดเห็น / หลักฐานเพิ่มเติม" />
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-1.5">
                      {mode === "manager" && <span className="text-[11.5px] text-ink-3">ลูกทีมให้ตนเอง: <b>{selfOf(g.id)}</b></span>}
                      <RatingPicker value={kpiR[g.id] ?? null} onChange={(v) => setKpiR({ ...kpiR, [g.id]: v })} disabled={submitted} />
                      <span className="text-[11.5px] text-ink-3">{ratingLabel[kpiR[g.id] ?? 0]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Competency */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5"><CardTitle action={<span className="text-xs text-ink-3">น้ำหนัก {COMP_W}%</span>}>ส่วนที่ 2 · สมรรถนะ (Competency)</CardTitle></div>
            {(["core", "leadership", "functional"] as const).map((cat) => (
              <div key={cat}>
                <p className="px-5 py-2 bg-canvas text-xs font-semibold text-ink-3 uppercase tracking-wide">
                  {cat === "core" ? "Core Values" : cat === "leadership" ? "Leadership" : "Functional · ค้าปลีก"}
                </p>
                {competencies.filter((c) => c.category === cat).map((c) => (
                  <div key={c.id} className="px-5 py-3.5 flex flex-col md:flex-row md:items-center gap-2 border-b border-line last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-[14px]">{c.name}</p>
                      <p className="text-xs text-ink-3">ระดับที่ตำแหน่งต้องการ: {c.required} {mode === "manager" && <>· ลูกทีมให้ตนเอง: <b>{selfOf(c.id)}</b></>}</p>
                    </div>
                    <RatingPicker value={compR[c.id] ?? null} onChange={(v) => setCompR({ ...compR, [c.id]: v })} disabled={submitted} />
                  </div>
                ))}
              </div>
            ))}
          </Card>

          {/* Narrative */}
          <Card className="p-5">
            <CardTitle>ส่วนที่ 3 · สรุปและแผนพัฒนา</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="จุดแข็ง / ผลงานที่ภูมิใจ"><textarea className="input" rows={4} value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="เช่น ลด Shrinkage จาก 2.4% เหลือ 1.6%…" /></Field>
              <Field label="สิ่งที่ต้องพัฒนา (จะถูกนำไปสร้าง IDP ปีหน้า)"><textarea className="input" rows={4} value={improve} onChange={(e) => setImprove(e.target.value)} placeholder="เช่น การวิเคราะห์ข้อมูลยอดขาย, P&L…" /></Field>
            </div>
          </Card>
        </div>

        {/* Score summary */}
        <div className="xl:sticky xl:top-24 space-y-4">
          <Card className="p-5">
            <CardTitle>สรุปคะแนน</CardTitle>
            <div className="text-center py-2">
              <p className="font-display text-[44px] font-semibold text-navy-800 leading-none">{overall.toFixed(2)}</p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-leaf-50 text-leaf-600 px-3 py-1 text-sm font-medium"><Sparkles size={14} />{ratingLabel[Math.round(overall)] || "—"}</p>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-3">KPI ({KPI_W}%)</dt><dd className="font-semibold">{kpiScore.toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Competency ({COMP_W}%)</dt><dd className="font-semibold">{compScore.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="text-ink-3">ประเมินครบ</dt><dd className={cx("font-semibold", doneCount === total ? "text-[#087a08]" : "text-warn")}>{doneCount}/{total} ข้อ</dd></div>
            </dl>
            <p className="text-[11.5px] text-ink-3 mt-3 leading-relaxed">คะแนนรวม = KPI × {KPI_W}% + Competency × {COMP_W}% (ตั้งค่าตามกลุ่มพนักงานในหน้า Admin)</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => toast("บันทึกร่างแล้ว", "info")} disabled={submitted}><Save size={15} />บันทึกร่าง</Button>
              <Button onClick={() => { setSubmitted(true); toast(mode === "self" ? "ส่งแบบประเมินให้หัวหน้าแล้ว" : "ส่งผลประเมินเข้าสู่ Calibration แล้ว"); }} disabled={submitted || doneCount < total}>
                <Send size={15} />{submitted ? "ส่งแล้ว" : "ส่ง"}
              </Button>
            </div>
            {doneCount < total && <p className="text-[11.5px] text-warn mt-2 text-center">กรุณาให้คะแนนให้ครบทุกข้อก่อนส่ง</p>}
          </Card>
          <Card className="p-4 text-[12.5px] text-ink-2 space-y-1">
            <p className="font-semibold text-ink mb-1">เกณฑ์คะแนน</p>
            {[5, 4, 3, 2, 1].map((n) => <p key={n}><b className="inline-block w-4">{n}</b> {ratingLabel[n]}</p>)}
          </Card>
        </div>
      </div>
    </div>
  );
}
