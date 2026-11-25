import { useEffect, useState } from "react";
import * as liveApi from "../data/live";
import { Plus, Send, Target, ChevronRight, Building, Store, User, Pencil, Trash, Library, Link as LinkIcon, Info, CircleCheck } from "lucide-react";
import { useStore } from "../data/store";
import { companyGoals } from "../data/mock";
import { Button, Card, Field, Modal, PageHeader, Progress, SourceTag, StatusPill, Tabs, cx, fmt, fmtCompact, toneOf } from "../components/ui";
import { Sparkline } from "../components/charts";
import { progressOf } from "./Home";
import type { DataSource, Direction, Goal } from "../data/types";

type LibKpi = { code: string; name: string; unit: string; direction: Direction; source: DataSource; family: string; weight?: number | null; target?: string; formula?: string; frequency?: string; ratings?: string[] };
/** ตัวเลขแรกในข้อความเป้าหมาย เช่น "ไม่น้อยกว่า 99%" → 99 */
const firstNum = (t?: string) => { const m = (t ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? m[0] : ""; };

// คลัง KPI ตัวอย่าง (ใช้เมื่อยังไม่ได้ต่อฐานข้อมูล หรือตำแหน่งนี้ยังไม่มี KPI ในแอปหลัก)
const kpiLibrary: LibKpi[] = [
  { code: "RT-SALES", name: "ยอดขายเทียบเป้า", unit: "บาท", direction: "higher_better", source: "pos", family: "ค้าปลีก" },
  { code: "RT-SHRINK", name: "สินค้าสูญหาย (Shrinkage)", unit: "%", direction: "lower_better", source: "pos", family: "ค้าปลีก" },
  { code: "RT-CSAT", name: "คะแนนความพึงพอใจลูกค้า", unit: "คะแนน", direction: "higher_better", source: "crm", family: "ค้าปลีก" },
  { code: "RT-BASKET", name: "มูลค่าต่อบิลเฉลี่ย (Basket size)", unit: "บาท", direction: "higher_better", source: "pos", family: "ค้าปลีก" },
  { code: "FC-OUTPUT", name: "ผลผลิตเทียบแผน (Output vs Plan)", unit: "%", direction: "higher_better", source: "mes", family: "โรงงาน" },
  { code: "FC-YIELD", name: "Yield การผลิต", unit: "%", direction: "higher_better", source: "mes", family: "โรงงาน" },
  { code: "FC-DEFECT", name: "อัตราของเสีย (Defect rate)", unit: "%", direction: "lower_better", source: "qms", family: "โรงงาน" },
  { code: "SAFE-LTI", name: "อุบัติเหตุถึงขั้นหยุดงาน (LTI)", unit: "ครั้ง", direction: "lower_better", source: "mes", family: "โรงงาน" },
  { code: "FM-SELLIN", name: "ยอด Sell-in เทียบเป้า", unit: "บาท", direction: "higher_better", source: "crm", family: "FMCG" },
  { code: "FM-OTIF", name: "ส่งสินค้าตรงเวลาครบถ้วน (OTIF)", unit: "%", direction: "higher_better", source: "manual", family: "FMCG" },
  { code: "HR-ATTEND", name: "การมาทำงาน (ไม่ขาด/สาย)", unit: "%", direction: "higher_better", source: "tna", family: "ทุกสายงาน" },
  { code: "LMS-HOURS", name: "ชั่วโมงอบรมต่อปี", unit: "ชม.", direction: "higher_better", source: "lms", family: "ทุกสายงาน" },
];

const fmtVal = (v: number | null, unit: string) => (v === null ? "–" : unit === "บาท" ? fmtCompact(v) : fmt(v, v % 1 ? 1 : 0));

export default function Goals() {
  const { goals, addGoal, updateGoal, removeGoal, submitGoals, approveGoals, goalsSubmitted, toast, liveStatus, subject, managerOf, posKpis, goalsFromPositionKpis } = useStore();
  const ready = liveStatus === "ready";
  // KPI ตามตำแหน่งจากแอปหลัก (JD/KPI/Competency) — ถ้ายังไม่มี ใช้คลังตัวอย่าง
  const fromHr = ready && posKpis.length > 0;
  const { cycle } = useStore();
  const [orgGoals, setOrgGoals] = useState<(Goal & { level: string })[]>([]);
  useEffect(() => { if (ready && cycle) liveApi.loadOrgGoals(cycle.id).then(setOrgGoals, () => setOrgGoals([])); }, [ready, cycle]);
  const lib: LibKpi[] = fromHr ? posKpis : kpiLibrary;
  const mgr = ready ? managerOf(subject) : null;
  const hasPending = goals.some((g) => g.status === "pending_approval");
  const [tab, setTab] = useState<"mine" | "cascade" | "library">("mine");
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<Goal | null>(null);
  const totalWeight = goals.reduce((s, g) => s + g.weight, 0);
  const auto = goals.filter((g) => g.source !== "manual").length;
  const hasDraft = goals.some((g) => g.status === "draft");

  return (
    <div>
      <PageHeader icon={<Target size={22} />} title="ตั้งเป้าหมาย (Goal & KPI)" subtitle="เชื่อมโยงเป้าบริษัท → ทีม → บุคคล · ค่าจริงอัปเดตอัตโนมัติจาก POS / MES / LMS"
        actions={<>
          <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} />เพิ่มเป้าหมาย</Button>
          <Button disabled={!hasDraft || totalWeight !== 100} title={totalWeight !== 100 ? "น้ำหนักรวมต้องเท่ากับ 100%" : ""}
            onClick={() => { submitGoals(); toast(ready ? `ส่งเป้าหมายให้หัวหน้า${mgr ? ` (${mgr.name})` : ""} อนุมัติแล้ว` : "ส่งเป้าหมายให้คุณวิภาวดีอนุมัติแล้ว"); }}>
            <Send size={16} />ส่งให้หัวหน้าอนุมัติ
          </Button>
          {hasPending && (
            <Button variant="secondary" onClick={approveGoals} title="HR / หัวหน้างาน อนุมัติเป้าหมายที่รออนุมัติทั้งหมดของพนักงานคนนี้">
              <CircleCheck size={16} />อนุมัติเป้าหมาย
            </Button>
          )}
        </>} />

      <Tabs value={tab} onChange={setTab} items={[
        { value: "mine", label: ready && subject ? `เป้าหมายของ ${subject.nickname || subject.name}` : "เป้าหมายของฉัน", count: goals.length },
        { value: "cascade", label: "เป้าองค์กร (Cascade)" },
        { value: "library", label: "คลัง KPI" },
      ]} />

      {tab === "mine" && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="flex justify-between text-sm"><span className="text-ink-3">น้ำหนักรวม</span><b className={totalWeight === 100 ? "text-[#087a08]" : "text-crit"}>{totalWeight}% / 100%</b></div>
              <Progress value={totalWeight} tone={totalWeight === 100 ? "good" : "crit"} className="mt-2" />
            </Card>
            <Card className="p-4">
              <div className="flex justify-between text-sm"><span className="text-ink-3">จำนวนเป้าหมาย</span><b>{goals.length} ข้อ</b></div>
              <p className="text-xs text-ink-3 mt-2">กลุ่มค้าปลีก: 3–7 ข้อ · KPI 60% : Competency 40%</p>
            </Card>
            <Card className="p-4">
              <div className="flex justify-between text-sm"><span className="text-ink-3">ดึงค่าจริงอัตโนมัติ</span><b>{auto} / {goals.length}</b></div>
              <p className="text-xs text-ink-3 mt-2">ลดการกรอกมือ · หลักฐานโปร่งใส</p>
            </Card>
          </div>

          {!goalsSubmitted && (
            <div className="flex items-start gap-2 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-brand-700">
              <Info size={16} className="mt-0.5 shrink-0" />มีเป้าหมายฉบับร่าง — ตรวจสอบน้ำหนักให้ครบ 100% แล้วกด “ส่งให้หัวหน้าอนุมัติ”
            </div>
          )}

          {ready && goals.length === 0 && (
            <Card className="p-8 text-center text-ink-3">
              <Target className="mx-auto mb-2 text-ink-3" size={28} />
              ยังไม่มีเป้าหมายของ {subject?.name ?? "พนักงานคนนี้"} ในรอบนี้ — กด <b className="text-ink">เพิ่มเป้าหมาย</b> เพื่อเริ่ม (น้ำหนักรวมต้องครบ 100%)
            {posKpis.length > 0 && <div className="mt-4"><Button onClick={goalsFromPositionKpis}><Library size={16} />สร้างเป้าหมายจาก KPI ตามตำแหน่ง ({posKpis.length} ข้อ)</Button></div>}
            </Card>
          )}

          {goals.map((g) => {
            const p = progressOf(g);
            return (
              <Card key={g.id} className="p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-semibold text-[15.5px] text-navy-800">{g.title}</h3>
                      <StatusPill status={g.status} />
                    </div>
                    <p className="text-[13px] text-ink-3 mt-0.5">{g.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-ink-3">
                      <SourceTag source={g.source} />
                      {g.lastUpdated && <span>อัปเดต {g.lastUpdated}</span>}
                      {g.kpiCode && <span className="font-mono text-[11px] bg-canvas px-1.5 rounded">{g.kpiCode}</span>}
                      {g.parentId && <span className="inline-flex items-center gap-1"><LinkIcon size={11} />เชื่อมกับเป้าสาขา</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 md:w-[460px] shrink-0">
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm"><b className="font-display text-lg text-ink">{fmtVal(g.actual, g.unit)}</b> <span className="text-ink-3">/ {fmtVal(g.target, g.unit)} {g.unit !== "บาท" && g.unit}</span></span>
                        <span className="text-sm font-semibold text-ink-2">{Math.round(p)}%</span>
                      </div>
                      <Progress value={p} tone={toneOf(g.status)} className="mt-1.5" />
                      <p className="text-[11.5px] text-ink-3 mt-1">{g.direction === "lower_better" ? "ยิ่งน้อยยิ่งดี" : "ยิ่งมากยิ่งดี"} · น้ำหนัก {g.weight}%</p>
                    </div>
                    {g.history && <div className="hidden sm:block"><Sparkline values={g.history} color={g.status === "at_risk" ? "#b77800" : "#2a78d6"} /></div>}
                    <div className="flex flex-col gap-1">
                      {ready || g.source === "manual" || g.status === "draft" ? (
                        <Button size="sm" variant="secondary" onClick={() => setUpdating(g)}><Pencil size={13} />อัปเดต</Button>
                      ) : (
                        <span className="text-[11px] text-ink-3 text-center leading-tight">อัตโนมัติ<br />จาก {g.source.toUpperCase()}</span>
                      )}
                      {g.status === "draft" && <Button size="sm" variant="ghost" onClick={() => removeGoal(g.id)} aria-label="ลบ"><Trash size={13} /></Button>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "cascade" && ready && (
        <Card className="mt-5 p-5">
          <p className="text-sm text-ink-3 mb-4">เป้าหมายระดับบริษัท / ทีม ในรอบ {cycle?.name}</p>
          {orgGoals.length === 0 && <p className="text-sm text-ink-3">ยังไม่มีเป้าหมายองค์กรในรอบนี้ — HR เพิ่มเป้าหมายประเภท “บริษัท” หรือ “ทีม” ได้ในฐานข้อมูล GrowTogether</p>}
          <ul className="space-y-3">{orgGoals.map((g) => (
            <li key={g.id} className="card p-3.5 flex flex-wrap items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-navy-800 text-white flex items-center justify-center">{g.type === "company" ? <Building size={16} /> : <Store size={16} />}</span>
              <div className="flex-1 min-w-[180px]"><p className="text-[11px] text-ink-3">{g.level}</p><p className="font-medium">{g.title}</p></div>
              <div className="w-40"><Progress value={progressOf(g)} tone="good" /><p className="text-[11px] text-ink-3 mt-1">{g.actual ?? "–"} / {g.target} {g.unit}</p></div>
            </li>))}</ul>
        </Card>
      )}

      {tab === "cascade" && !ready && (
        <Card className="mt-5 p-5">
          <p className="text-sm text-ink-3 mb-4">เป้าหมายของคุณเชื่อมโยงกับเป้าหมายองค์กรอย่างไร</p>
          <ol className="space-y-3">
            {[
              { icon: <Building size={16} />, g: companyGoals[0], level: "บริษัท" },
              { icon: <Store size={16} />, g: companyGoals[1], level: "BU ค้าปลีก" },
              { icon: <Store size={16} />, g: companyGoals[2], level: "สาขาบางนา" },
            ].map((x, i) => (
              <li key={x.g.id} style={{ marginLeft: i * 28 }} className="flex items-center gap-3">
                {i > 0 && <span className="text-ink-3">└</span>}
                <div className="flex-1 card p-3.5 flex flex-wrap items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-navy-800 text-white flex items-center justify-center">{x.icon}</span>
                  <div className="flex-1 min-w-[180px]"><p className="text-[11px] text-ink-3">{x.level}</p><p className="font-medium">{x.g.title}</p></div>
                  <div className="w-40"><Progress value={progressOf(x.g)} tone="good" /><p className="text-[11px] text-ink-3 mt-1">{x.g.actual} / {x.g.target} {x.g.unit}</p></div>
                </div>
              </li>
            ))}
            <li style={{ marginLeft: 84 }} className="flex items-center gap-3">
              <span className="text-ink-3">└</span>
              <div className="flex-1 card p-3.5 border-brand-200 bg-brand-50/40 flex flex-wrap items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center"><User size={16} /></span>
                <div className="flex-1"><p className="text-[11px] text-ink-3">เป้าหมายของคุณ (สนับสนุน {goals.filter((g) => g.parentId).length || 1} ข้อ)</p>
                  <p className="font-medium">{goals[0]?.title}</p></div>
                <ChevronRight className="text-ink-3" size={18} />
              </div>
            </li>
          </ol>
        </Card>
      )}

      {tab === "library" && (
        <Card className="mt-5 overflow-hidden">
          <div className="px-4 py-3 text-xs text-ink-3 border-b border-line">
            {fromHr ? <>KPI ของตำแหน่ง <b className="text-ink-2">{subject?.position || subject?.positionCode}</b> ({subject?.positionCode}) · ดึงจาก JD / KPI / Competency ในระบบ HR หลัก</>
              : ready ? <>ตำแหน่งของพนักงานที่เลือกยังไม่มี KPI ในระบบ HR หลัก (ตั้งที่ ตั้งค่าองค์กร › การจัดการตำแหน่งงาน) — แสดงคลังตัวอย่าง</> : <>คลัง KPI ตัวอย่าง</>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-ink-3 text-left text-xs">
                <tr><th className="px-4 py-3 font-medium">รหัส</th><th className="px-4 py-3 font-medium">KPI</th><th className="px-4 py-3 font-medium">{fromHr ? "เป้าหมาย / น้ำหนัก" : "สายงาน"}</th><th className="px-4 py-3 font-medium">หน่วย</th><th className="px-4 py-3 font-medium">ทิศทาง</th><th className="px-4 py-3 font-medium">แหล่งข้อมูล</th><th /></tr>
              </thead>
              <tbody>
                {lib.map((k) => (
                  <tr key={k.code} className="border-t border-line hover:bg-[#fafcfe]">
                    <td className="px-4 py-3 font-mono text-xs text-ink-3">{k.code}</td>
                    <td className="px-4 py-3 font-medium">{k.name}{k.formula && <p className="text-[11.5px] font-normal text-ink-3 mt-0.5">{k.formula}</p>}</td>
                    <td className="px-4 py-3 text-ink-2">{fromHr ? <>{k.target || "–"}{k.weight != null && <span className="text-ink-3"> · {k.weight}%</span>}</> : k.family}</td>
                    <td className="px-4 py-3 text-ink-2">{k.unit}</td>
                    <td className="px-4 py-3 text-ink-2">{k.direction === "lower_better" ? "↓ น้อยดี" : "↑ มากดี"}</td>
                    <td className="px-4 py-3"><SourceTag source={k.source} /></td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus size={14} />ใช้</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddGoalModal open={adding} lib={lib} onClose={() => setAdding(false)} remaining={100 - totalWeight}
        onSave={(g) => { addGoal(g); setAdding(false); toast("เพิ่มเป้าหมายฉบับร่างแล้ว"); }} />
      <UpdateModal goal={updating} onClose={() => setUpdating(null)}
        onSave={(id, actual, note) => { updateGoal(id, { actual, lastUpdated: "เมื่อสักครู่" }, note); setUpdating(null); toast("บันทึกความคืบหน้าแล้ว"); }} />
    </div>
  );
}

function AddGoalModal({ open, onClose, onSave, remaining, lib }: { open: boolean; onClose: () => void; remaining: number; lib: LibKpi[]; onSave: (g: Omit<Goal, "id" | "status">) => void }) {
  const [kpi, setKpi] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState("");
  const [weight, setWeight] = useState(String(Math.max(0, remaining)));
  const { liveStatus } = useStore();
  const k = lib.find((x) => x.code === kpi);
  const families = [...new Set(lib.map((x) => x.family))];
  const valid = title.trim() && Number(target) > 0 && Number(weight) > 0;

  return (
    <Modal open={open} onClose={onClose} title="เพิ่มเป้าหมาย" footer={<>
      <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
      <Button disabled={!valid} onClick={() => {
        onSave({ title, description: desc, type: "individual", kpiCode: k?.code, unit: k?.unit ?? "%", direction: k?.direction ?? "higher_better",
          target: Number(target), actual: k && k.source !== "manual" ? 0 : null, weight: Number(weight), source: k?.source ?? "manual", dueDate: "2026-12-31", parentId: "c3" });
        setKpi(""); setTitle(""); setDesc(""); setTarget("");
      }}>บันทึกเป็นร่าง</Button>
    </>}>
      <div className="space-y-4">
        <Field label="เลือกจากคลัง KPI (แนะนำ)" hint={k && k.source !== "manual" ? `ค่าจริงจะดึงอัตโนมัติจาก ${k.source.toUpperCase()} ทุกวัน` : "หรือเว้นว่างเพื่อสร้างเป้าหมายเอง (กรอกความคืบหน้าเอง)"}>
          <div className="relative">
            <Library size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <select className="input pl-9" value={kpi} onChange={(e) => { setKpi(e.target.value); const x = lib.find((y) => y.code === e.target.value); if (x) { setTitle(x.name);
              if (x.target || x.formula) setDesc([x.target && `เป้าหมาย: ${x.target}`, x.formula && `สูตร: ${x.formula}`, x.frequency && `ความถี่: ${x.frequency}`].filter(Boolean).join("\n"));
              if (firstNum(x.target)) setTarget(firstNum(x.target));
              if (x.weight != null) setWeight(String(x.weight)); } }}>
              <option value="">— สร้างเป้าหมายเอง —</option>
              {families.map((f) => (
                <optgroup key={f} label={f}>{lib.filter((x) => x.family === f).map((x) => <option key={x.code} value={x.code}>{x.name}{x.weight != null ? ` (${x.weight}%)` : ""}</option>)}</optgroup>
              ))}
            </select>
          </div>
        </Field>
        <Field label="ชื่อเป้าหมาย"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เพิ่มยอดขายสินค้า Private Label" /></Field>
        <Field label="รายละเอียด / วิธีวัดผล"><textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="SMART: เฉพาะเจาะจง วัดได้ ทำได้จริง เกี่ยวข้อง มีกรอบเวลา" /></Field>
        <div className="grid grid-cols-2 gap-3">
          {k?.ratings && k.ratings.some(Boolean) && (
          <div className="rounded-lg bg-canvas px-3 py-2 text-[12px] text-ink-2 space-y-0.5">
            <p className="font-semibold text-ink-3">เกณฑ์ให้คะแนน (จากระบบ HR)</p>
            {k.ratings.map((r, i) => r && <p key={i}><b>{i + 1}</b> · {r}</p>)}
          </div>
        )}
        <Field label={`ค่าเป้าหมาย ${k?.unit ? `(${k.unit})` : ""}`}><input className="input" type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="น้ำหนัก (%)" hint={`คงเหลือ ${remaining}%`}><input className={cx("input", Number(weight) > remaining && "border-crit")} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        </div>
        {liveStatus !== "ready" && <Field label="เชื่อมกับเป้าหมายระดับบน">
          <select className="input" defaultValue="c3">{companyGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
        </Field>}
      </div>
    </Modal>
  );
}

function UpdateModal({ goal, onClose, onSave }: { goal: Goal | null; onClose: () => void; onSave: (id: string, actual: number, note: string) => void }) {
  const [v, setV] = useState("");
  const [note, setNote] = useState("");
  if (!goal) return null;
  return (
    <Modal open onClose={onClose} title="อัปเดตความคืบหน้า" footer={<>
      <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
      <Button disabled={v === ""} onClick={() => { onSave(goal.id, Number(v), note); setV(""); setNote(""); }}>บันทึก</Button>
    </>}>
      <p className="font-medium">{goal.title}</p>
      <p className="text-sm text-ink-3">เป้าหมาย {fmtVal(goal.target, goal.unit)} {goal.unit} · ปัจจุบัน {fmtVal(goal.actual, goal.unit)}</p>
      <div className="mt-4 space-y-3">
        <Field label={`ค่าจริงล่าสุด (${goal.unit})`}><input className="input" type="number" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></Field>
        <Field label="บันทึกเพิ่มเติม / หลักฐาน"><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
