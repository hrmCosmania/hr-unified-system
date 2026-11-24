import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, Funnel, CircleCheck, MessagesSquare, ClipboardCheck } from "lucide-react";
import { useStore } from "../data/store";
import { team } from "../data/mock";
import { Avatar, Button, Card, CardTitle, PageHeader, Progress, Stat, StatusPill, cx, thDate, toneOf } from "../components/ui";

const planLabel: Record<string, { l: string; c: string }> = {
  goal_pending: { l: "รออนุมัติเป้า", c: "bg-brand-50 text-brand-700" },
  goal_approved: { l: "เป้าอนุมัติแล้ว", c: "bg-good-bg text-[#087a08]" },
  self_review: { l: "รอประเมินตนเอง", c: "bg-[#eef1f5] text-ink-2" },
  manager_review: { l: "รอคุณประเมิน", c: "bg-warn-bg text-warn" },
  released: { l: "แจ้งผลแล้ว", c: "bg-good-bg text-[#087a08]" },
};
const daysSince = (d: string | null) => (d ? Math.round((Date.parse("2026-11-24") - Date.parse(d)) / 86400000) : null);

export default function Team() {
  const { toast } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [health, setHealth] = useState("all");
  const [approved, setApproved] = useState(false);
  const rows = useMemo(() => team.filter((t) => (health === "all" || t.health === health) && (t.name.includes(q) || t.position.toLowerCase().includes(q.toLowerCase()))), [q, health]);
  const risk = team.filter((t) => t.health === "at_risk" || t.health === "off_track").length;
  const ck30 = team.filter((t) => (daysSince(t.lastCheckin) ?? 999) <= 30).length;

  return (
    <div>
      <PageHeader icon={<Users size={22} />} title="ทีมของฉัน" subtitle="สาขาบางนา (ST045) · ข้อมูลโครงสร้างทีมจาก Core HR อัปเดตอัตโนมัติ" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="สมาชิกในทีม" value={team.length} sub="รวมพนักงานทดลองงาน 1 คน" />
        <Stat label="ตั้งเป้าหมายแล้ว" value={`${team.filter((t) => t.health !== "no_goal").length + (approved ? 1 : 0)}/${team.length}`} sub={approved ? "ครบแล้ว" : "รออนุมัติ 1 คน"} tone={approved ? "good" : "warn"} />
        <Stat label="Check-in ภายใน 30 วัน" value={`${ck30}/${team.length}`} sub={`${Math.round((ck30 / team.length) * 100)}% ของทีม`} tone="good" />
        <Stat label="ต้องดูแล / เสี่ยง" value={risk} sub="เป้าหมายต่ำกว่าแผน" tone="crit" />
      </div>

      {!approved && (
        <Card className="p-4 mb-5 border-brand-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <Avatar p={team[7]} size={40} />
          <div className="flex-1"><p className="font-semibold">ณัฐพล ศักดิ์ดี ส่งเป้าหมายทดลองงาน 3 ข้อ รออนุมัติ</p>
            <p className="text-sm text-ink-3">ยอดขายรายบุคคล 35,000 บาท/เดือน (40%) · ผ่าน Service Excellence (30%) · ไม่ขาด/สาย (30%) — สร้างอัตโนมัติจาก Recruitment</p></div>
          <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => toast("ส่งกลับให้แก้ไขแล้ว", "info")}>ขอแก้ไข</Button>
            <Button size="sm" variant="leaf" onClick={() => { setApproved(true); toast("อนุมัติเป้าหมายแล้ว"); }}><CircleCheck size={15} />อนุมัติ</Button></div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-line">
          <CardTitle>รายชื่อทีม</CardTitle>
          <div className="flex-1" />
          <div className="relative sm:w-64"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="input pl-9 h-9 py-1" placeholder="ค้นหาชื่อ / ตำแหน่ง" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="relative"><Funnel size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <select className="input pl-9 h-9 py-1 sm:w-44" value={health} onChange={(e) => setHealth(e.target.value)}>
              <option value="all">สถานะทั้งหมด</option><option value="on_track">ตามเป้า</option><option value="at_risk">ต้องดูแล</option><option value="off_track">เสี่ยง</option><option value="no_goal">ยังไม่ตั้งเป้า</option>
            </select></div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-xs text-ink-3 text-left"><tr>
              <th className="px-4 py-3 font-medium">ชื่อ</th><th className="px-4 py-3 font-medium">สถานะเป้าหมาย</th><th className="px-4 py-3 font-medium w-44">ความคืบหน้า</th>
              <th className="px-4 py-3 font-medium">Check-in ล่าสุด</th><th className="px-4 py-3 font-medium">การประเมิน</th><th className="px-4 py-3 font-medium text-center">ตนเอง</th><th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {rows.map((t) => {
                const ds = daysSince(t.lastCheckin);
                return (
                  <tr key={t.id} className="border-t border-line hover:bg-[#fafcfe]">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar p={t} size={34} /><div><p className="font-medium">{t.name}</p><p className="text-xs text-ink-3">{t.position}</p></div></div></td>
                    <td className="px-4 py-3"><StatusPill status={t.health} /></td>
                    <td className="px-4 py-3">{t.goals && t.health !== "no_goal" ? <div className="flex items-center gap-2"><Progress value={t.progress} tone={toneOf(t.health)} height={6} /><span className="text-xs w-8">{t.progress}%</span></div> : <span className="text-ink-3 text-xs">–</span>}</td>
                    <td className={cx("px-4 py-3 text-[13px]", ds !== null && ds > 45 ? "text-crit font-medium" : "text-ink-2")}>{t.lastCheckin ? `${thDate(t.lastCheckin, false)} (${ds} วัน)` : "ยังไม่เคย"}</td>
                    <td className="px-4 py-3"><span className={cx("text-xs rounded-full px-2 py-0.5 font-medium", planLabel[t.planStatus].c)}>{planLabel[t.planStatus].l}</span></td>
                    <td className="px-4 py-3 text-center font-semibold">{t.selfScore ?? <span className="text-ink-3 font-normal">–</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => nav("/checkin")} title="Check-in"><MessagesSquare size={15} /></Button>
                      <Button size="sm" variant={t.planStatus === "manager_review" ? "primary" : "ghost"} onClick={() => nav("/review")}><ClipboardCheck size={15} />{t.planStatus === "manager_review" && "ประเมิน"}</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-line">
          {rows.map((t) => (
            <div key={t.id} className="p-4">
              <div className="flex items-center gap-3"><Avatar p={t} size={38} /><div className="flex-1"><p className="font-medium">{t.name}</p><p className="text-xs text-ink-3">{t.position}</p></div><StatusPill status={t.health} /></div>
              <div className="flex items-center gap-2 mt-3"><Progress value={t.progress} tone={toneOf(t.health)} height={6} /><span className="text-xs">{t.progress}%</span></div>
              <div className="flex justify-between mt-2 text-xs text-ink-3"><span>Check-in: {t.lastCheckin ? thDate(t.lastCheckin, false) : "ยังไม่เคย"}</span><span className={cx("rounded-full px-2", planLabel[t.planStatus].c)}>{planLabel[t.planStatus].l}</span></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
