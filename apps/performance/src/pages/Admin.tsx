import { useState } from "react";
import {
  Settings, Save, RefreshCw, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CircleCheck, TriangleExclamationPoint, CircleX,
  Users, Search as SearchIcon, BookOpen, Clock, Banknote, ShoppingCart, Factory, ShieldCheck, Briefcase, Webhook, KeyRound,
} from "lucide-react";
import { useStore } from "../data/store";
import { competencies, cycle, integrations } from "../data/mock";
import { Button, Card, CardTitle, PageHeader, Stepper, Tabs, cx, fmt } from "../components/ui";

const icons: Record<string, React.ReactNode> = {
  core_hr: <Users size={20} />, recruitment: <SearchIcon size={20} />, lms: <BookOpen size={20} />, tna: <Clock size={20} />,
  payroll: <Banknote size={20} />, pos: <ShoppingCart size={20} />, mes: <Factory size={20} />, qms: <ShieldCheck size={20} />, internal_job: <Briefcase size={20} />,
};

export default function Admin() {
  const { toast } = useStore();
  const [tab, setTab] = useState<"cycle" | "weights" | "competency" | "integration" | "roles">("integration");
  const [syncing, setSyncing] = useState<string | null>(null);

  return (
    <div>
      <PageHeader icon={<Settings size={22} />} title="ตั้งค่าระบบ (Admin)" subtitle="สำหรับ HR Admin / HRIS" />
      <Tabs value={tab} onChange={setTab} items={[
        { value: "cycle", label: "รอบการประเมิน" },
        { value: "weights", label: "น้ำหนัก & แบบฟอร์ม" },
        { value: "competency", label: "Competency Library" },
        { value: "integration", label: "การเชื่อมต่อระบบ HRM" },
        { value: "roles", label: "สิทธิ์ผู้ใช้" },
      ]} />

      {tab === "cycle" && (
        <Card className="mt-5 p-5">
          <CardTitle action={<span className="text-xs rounded-full bg-good-bg text-[#087a08] px-2 py-0.5">Active</span>}>สร้าง / แก้ไขรอบประเมิน</CardTitle>
          <Stepper current={4} steps={cycle.phases.map((p) => ({ label: p.label }))} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <label><span className="label">ชื่อรอบ</span><input className="input" defaultValue="ประเมินผล 2026" /></label>
            <label><span className="label">ปี</span><input className="input" defaultValue="2026" /></label>
            <label><span className="label">ใช้กับ</span><select className="input"><option>พนักงานทุกคน (11,680)</option><option>เฉพาะ BU</option></select></label>
          </div>
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-3 bg-canvas"><tr><th className="text-left px-3 py-2 font-medium">ขั้นตอน</th><th className="px-3 py-2 font-medium text-left">เริ่ม</th><th className="px-3 py-2 font-medium text-left">สิ้นสุด</th><th className="px-3 py-2 font-medium text-left">แจ้งเตือน</th></tr></thead>
              <tbody>
                {[["ตั้งเป้าหมาย", "2026-01-01", "2026-02-15"], ["Check-in (รายเดือน)", "2026-02-16", "2026-12-15"], ["Mid-year Review", "2026-07-01", "2026-07-31"], ["360° Feedback", "2026-10-01", "2026-10-31"], ["ประเมินปลายปี", "2026-11-16", "2026-12-15"], ["Calibration", "2026-12-16", "2026-12-23"], ["แจ้งผล & ส่ง Payroll", "2027-01-05", "2027-01-15"]].map(([n, s, e]) => (
                  <tr key={n} className="border-t border-line">
                    <td className="px-3 py-2 font-medium">{n}</td>
                    <td className="px-3 py-2"><input type="date" className="input py-1.5" defaultValue={s} /></td>
                    <td className="px-3 py-2"><input type="date" className="input py-1.5" defaultValue={e} /></td>
                    <td className="px-3 py-2 text-ink-2 text-[13px]">In-app · LINE · Email (ก่อนครบ 7/3/1 วัน)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4"><Button onClick={() => toast("บันทึกรอบการประเมินแล้ว")}><Save size={16} />บันทึก</Button></div>
        </Card>
      )}

      {tab === "weights" && (
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <Card className="p-5">
            <CardTitle>น้ำหนักคะแนนตามกลุ่มพนักงาน</CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-3 bg-canvas"><tr>{["กลุ่ม", "KPI %", "Competency %", "จำนวนเป้า", "KPI อัตโนมัติจาก"].map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {[["สำนักงานใหญ่ (HQ)", 70, 30, "3–7", "Manual / OKR"], ["ค้าปลีก (Store)", 60, 40, "3–6", "POS · CRM · T&A"], ["FMCG (Sales)", 70, 30, "3–6", "CRM · ERP"], ["โรงงาน (Factory)", 50, 50, "3–5", "MES · QMS · T&A"], ["ทดลองงาน (Probation)", 50, 50, "3", "Recruitment template"]].map(([g, k, c, n, s]) => (
                    <tr key={g as string} className="border-t border-line">
                      <td className="px-3 py-2.5 font-medium">{g}</td>
                      <td className="px-3 py-2.5"><input className="input py-1.5 w-20" type="number" defaultValue={k as number} /></td>
                      <td className="px-3 py-2.5"><input className="input py-1.5 w-20" type="number" defaultValue={c as number} /></td>
                      <td className="px-3 py-2.5 text-ink-2">{n}</td>
                      <td className="px-3 py-2.5 text-ink-2 text-[13px]">{s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="p-5">
            <CardTitle>Rating Scale & Guideline</CardTitle>
            {[[5, "โดดเด่น", 10], [4, "เกินความคาดหวัง", 20], [3, "ตามความคาดหวัง", 50], [2, "ต้องพัฒนา", 15], [1, "ต่ำกว่ามาตรฐาน", 5]].map(([v, l, g]) => (
              <div key={v as number} className="flex items-center gap-3 py-2 border-b border-line last:border-0 text-sm">
                <span className="w-7 h-7 rounded-lg bg-navy-800 text-white flex items-center justify-center font-semibold">{v}</span>
                <span className="flex-1">{l}</span>
                <input className="input py-1 w-16 text-right" defaultValue={g as number} /><span className="text-ink-3">%</span>
              </div>
            ))}
            <p className="text-xs text-ink-3 mt-3">ใช้เป็นแนวทางใน Calibration (ไม่บังคับ Forced ranking)</p>
          </Card>
        </div>
      )}

      {tab === "competency" && (
        <Card className="mt-5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-3 bg-canvas"><tr><th className="text-left px-4 py-3 font-medium">รหัส</th><th className="text-left px-4 py-3 font-medium">Competency</th><th className="text-left px-4 py-3 font-medium">กลุ่ม</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">ระดับพฤติกรรม</th></tr></thead>
            <tbody>
              {[...competencies, { id: "x1", code: "FN-LEAN", name: "Lean / การลดความสูญเปล่า", category: "functional" }, { id: "x2", code: "FN-SAFETY", name: "ความปลอดภัยในการทำงาน", category: "functional" }, { id: "x3", code: "FN-KAM", name: "การบริหารลูกค้าหลัก (Key Account)", category: "functional" }].map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs text-ink-3">{c.code}</td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3"><span className={cx("text-xs rounded-full px-2 py-0.5", c.category === "core" ? "bg-brand-50 text-brand-700" : c.category === "leadership" ? "bg-[#f1eefc] text-[#4b3bb5]" : "bg-leaf-50 text-leaf-600")}>{c.category === "core" ? "Core" : c.category === "leadership" ? "Leadership" : "Functional"}</span></td>
                  <td className="px-4 py-3 text-ink-3 text-[13px] hidden md:table-cell">1 เริ่มต้น · 2 พื้นฐาน · 3 ชำนาญ · 4 เชี่ยวชาญ · 5 ต้นแบบ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "integration" && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4"><p className="text-[13px] text-ink-3">ระบบที่เชื่อมต่อ</p><p className="font-display text-2xl font-semibold text-navy-800">{integrations.length}</p></Card>
            <Card className="p-4"><p className="text-[13px] text-ink-3">Events 24 ชม.</p><p className="font-display text-2xl font-semibold text-navy-800">{fmt(integrations.reduce((s, i) => s + i.records24h, 0))}</p></Card>
            <Card className="p-4"><p className="text-[13px] text-ink-3">ผิดพลาด / ค้างส่ง</p><p className="font-display text-2xl font-semibold text-crit">{integrations.reduce((s, i) => s + i.failed24h + i.pending, 0)}</p></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {integrations.map((s) => (
              <Card key={s.code} className="p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-navy-800 text-white flex items-center justify-center shrink-0">{icons[s.code]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-ink-3 leading-snug">{s.desc}</p>
                  </div>
                  {s.status === "ok" ? <CircleCheck size={18} className="text-good shrink-0" aria-label="ปกติ" /> : s.status === "warning" ? <TriangleExclamationPoint size={18} className="text-[#d99500] shrink-0" aria-label="เตือน" /> : <CircleX size={18} className="text-crit shrink-0" aria-label="ผิดพลาด" />}
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-ink-2">
                  {s.direction === "inbound" ? <><ArrowDownLeft size={13} />รับข้อมูลเข้า</> : s.direction === "outbound" ? <><ArrowUpRight size={13} />ส่งข้อมูลออก</> : <><ArrowLeftRight size={13} />สองทาง</>}
                  <span className="text-ink-3">· {s.schedule}</span>
                </div>
                <dl className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-lg bg-canvas py-1.5"><dt className="text-[10.5px] text-ink-3">24 ชม.</dt><dd className="text-sm font-semibold">{fmt(s.records24h)}</dd></div>
                  <div className={cx("rounded-lg py-1.5", s.failed24h ? "bg-crit-bg" : "bg-canvas")}><dt className="text-[10.5px] text-ink-3">ผิดพลาด</dt><dd className={cx("text-sm font-semibold", s.failed24h && "text-crit")}>{s.failed24h}</dd></div>
                  <div className={cx("rounded-lg py-1.5", s.pending ? "bg-warn-bg" : "bg-canvas")}><dt className="text-[10.5px] text-ink-3">ค้างส่ง</dt><dd className={cx("text-sm font-semibold", s.pending && "text-warn")}>{s.pending}</dd></div>
                </dl>
                {s.status === "error" && <p className="text-xs text-crit mt-2">⚠ timeout ขณะเชื่อม QMS API (01:00) — retry อัตโนมัติทุก 15 นาที</p>}
                <div className="flex items-center justify-between mt-auto pt-3 text-xs text-ink-3">
                  <span>ล่าสุด: {s.lastSync}</span>
                  <Button size="sm" variant="ghost" disabled={syncing === s.code} onClick={() => { setSyncing(s.code); setTimeout(() => { setSyncing(null); toast(`Sync ${s.name} สำเร็จ`); }, 1200); }}>
                    <RefreshCw size={13} className={syncing === s.code ? "animate-spin" : ""} />Sync
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <CardTitle icon={<Webhook size={16} className="text-brand-600" />}>API สำหรับระบบภายนอก</CardTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-navy-900 text-[#d6e4f7] p-4 font-mono text-[12px] leading-relaxed overflow-x-auto">
                <p className="text-[#8fe3b5]">POST /functions/v1/integration-inbound</p>
                <p>x-source: pos</p>
                <p>x-signature: sha256=&lt;HMAC&gt;</p>
                <p className="mt-2">{"{"} "event_id": "pos-20261124-ST045",</p>
                <p>&nbsp;&nbsp;"event_type": "kpi.actual",</p>
                <p>&nbsp;&nbsp;"data": [{"{"} "kpi_code": "RT-SALES",</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;"scope": "employee", "external_ref": "E10234",</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;"period": "2026-11", "value": 412000 {"}"}] {"}"}</p>
              </div>
              <ul className="space-y-2.5 text-ink-2">
                <li className="flex gap-2"><KeyRound size={16} className="text-brand-600 shrink-0 mt-0.5" />แต่ละระบบมี Secret ของตนเอง ลงลายเซ็น HMAC-SHA256 ทุกคำขอ</li>
                <li className="flex gap-2"><CircleCheck size={16} className="text-brand-600 shrink-0 mt-0.5" />Idempotent: ส่งซ้ำด้วย event_id เดิมจะไม่ถูกประมวลผลซ้ำ</li>
                <li className="flex gap-2"><RefreshCw size={16} className="text-brand-600 shrink-0 mt-0.5" />ขาออก (Payroll, LMS, Internal Job) ใช้ Outbox + retry แบบ backoff สูงสุด 8 ครั้ง</li>
                <li className="flex gap-2"><ShieldCheck size={16} className="text-brand-600 shrink-0 mt-0.5" />Schema integration เข้าถึงได้เฉพาะ service_role · ทุก event เก็บ log ตรวจสอบย้อนหลังได้</li>
              </ul>
            </div>
          </Card>
        </div>
      )}

      {tab === "roles" && (
        <Card className="mt-5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-3 bg-canvas"><tr>{["บทบาท", "ได้มาจาก", "ขอบเขตข้อมูล", "จำนวน"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {[["พนักงาน (employee)", "ทุกคนที่ sync จาก Core HR", "ข้อมูลของตนเอง", "11,680"], ["หัวหน้างาน (manager)", "อัตโนมัติจาก manager_id ใน Core HR", "ลูกทีมทุกระดับในสาย", "1,342"], ["HRBP", "กำหนดโดย HR Admin", "ทุกคนใน BU ที่ดูแล", "18"], ["HR Admin", "กำหนดโดย HR Admin", "ทั้งองค์กร + ตั้งค่า", "6"], ["ผู้บริหาร (executive)", "กำหนดโดย HR Admin", "Analytics ทั้งองค์กร (อ่านอย่างเดียว)", "24"]].map((r) => (
                <tr key={r[0]} className="border-t border-line">{r.map((c, i) => <td key={i} className={cx("px-4 py-3", i === 0 ? "font-medium" : "text-ink-2")}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
