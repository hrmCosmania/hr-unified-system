import { useState } from "react";
import { ChartColumn, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { analytics, ratingGuideline } from "../data/mock";
import { Button, Card, CardTitle, PageHeader, cx, fmt } from "../components/ui";
import { Donut, GroupedBars, Legend, LineChart } from "../components/charts";

export default function Analytics() {
  const [bu, setBu] = useState("all");
  const a = analytics;
  return (
    <div>
      <PageHeader icon={<ChartColumn size={22} />} title="ภาพรวมการประเมินผล 2026" subtitle={`พนักงานทั้งหมด ${fmt(a.headcount)} คน · ข้อมูล ณ 24 พ.ย. 2026 (real-time จาก Supabase)`}
        actions={<>
          <select className="input h-10 py-1 w-auto" value={bu} onChange={(e) => setBu(e.target.value)}>
            <option value="all">ทุกธุรกิจ</option>{a.byBU.map((b) => <option key={b.key} value={b.key}>{b.bu}</option>)}
          </select>
          <select className="input h-10 py-1 w-auto"><option>ทุกภูมิภาค</option><option>กรุงเทพฯ และปริมณฑล</option><option>ภาคตะวันออก</option><option>ภาคเหนือ</option></select>
          <Button variant="secondary"><Download size={16} />Export</Button>
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {a.kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-[13px] text-ink-3">{k.label}</p>
            <p className="font-display text-[28px] font-semibold text-navy-800 leading-tight mt-1">{k.value}%</p>
            <p className={cx("text-xs mt-1 inline-flex items-center gap-1", k.delta > 0 ? "text-[#087a08]" : "text-ink-3")}>
              {k.delta > 0 ? <TrendingUp size={13} /> : k.delta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
              {k.delta !== 0 ? `${k.delta > 0 ? "+" : ""}${k.delta} pts จากปีก่อน` : k.note}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-5">
          <CardTitle action={<span className="text-xs text-ink-3">% ของพนักงานในแต่ละธุรกิจ</span>}>ความคืบหน้ารายธุรกิจ</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-3"><tr><th className="text-left py-2 font-medium">ธุรกิจ</th><th className="text-right font-medium">พนักงาน</th>{["ตั้งเป้า", "Check-in", "ประเมินตนเอง", "IDP"].map((h) => <th key={h} className="font-medium px-2">{h}</th>)}</tr></thead>
              <tbody>
                {a.byBU.filter((b) => bu === "all" || b.key === bu).map((b) => (
                  <tr key={b.key} className="border-t border-line">
                    <td className="py-3 font-medium">{b.bu}</td>
                    <td className="text-right text-ink-2">{fmt(b.headcount)}</td>
                    {[b.goal, b.checkin, b.self, b.idp].map((v, i) => (
                      <td key={i} className="px-2 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cx("text-[13px] font-semibold", v < 70 ? "text-crit" : "text-ink")}>{v}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-[#e8eef6]"><div className="h-full rounded-full" style={{ width: `${v}%`, background: v < 70 ? "#d03b3b" : "#2a78d6" }} /></div>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3 mt-3">▲ ค้าปลีก: ประเมินตนเองต่ำสุด (58%) — แนะนำเปิด Kiosk ที่สาขาและแจ้งเตือนผ่าน LINE</p>
        </Card>

        <Card className="p-5">
          <CardTitle action={<span className="text-xs text-ink-3">% ของพนักงานที่ประเมินแล้ว</span>}>การกระจายผลประเมิน vs Guideline</CardTitle>
          <Legend items={[{ label: "ผลจริง", color: "#2a78d6" }, { label: "Guideline", color: "", hatch: true }]} />
          <GroupedBars categories={["5 โดดเด่น", "4 เกินคาด", "3 ตามคาด", "2 ต้องพัฒนา", "1 ต่ำกว่า"]} height={210}
            series={[{ label: "ผลจริง", values: [5, 4, 3, 2, 1].map((r) => a.ratingDist[r]), color: "#2a78d6" }, { label: "Guideline", values: [5, 4, 3, 2, 1].map((r) => ratingGuideline[r]), color: "", hatch: true }]} />
        </Card>

        <Card className="p-5">
          <CardTitle action={<span className="text-xs text-ink-3">เป้าหมาย 80%</span>}>พนักงานที่ Check-in สม่ำเสมอ (ภายใน 45 วัน)</CardTitle>
          <LineChart labels={a.months} values={a.checkinTrend} target={80} />
        </Card>

        <Card className="p-5">
          <CardTitle>Talent Matrix (9-Box) ทั้งองค์กร</CardTitle>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Donut size={150} thickness={18} segments={a.nineBox.map((n, i) => ({ label: n.label, value: n.value, color: ["#1baf7a", "#2a78d6", "#eb6834"][i] }))}
              center={<><span className="font-display text-2xl font-semibold text-navy-800">14%</span><span className="text-[11px] text-ink-3">Top Talent</span></>} />
            <ul className="space-y-3 flex-1 w-full">
              {a.nineBox.map((n, i) => (
                <li key={n.label} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm" style={{ background: ["#1baf7a", "#2a78d6", "#eb6834"][i] }} />
                  <span className="flex-1 text-ink-2">{n.label}</span><b>{n.value}%</b>
                </li>
              ))}
              <li className="pt-2 border-t border-line text-xs text-ink-3">ตำแหน่งสำคัญ {a.succession.critical} ตำแหน่ง · มีผู้สืบทอดพร้อมทันที {a.succession.readyNow} · พร้อมใน 1–2 ปี {a.succession.ready12} · <span className="text-crit">ยังไม่มี {a.succession.none}</span></li>
            </ul>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-2">
          <CardTitle action={<span className="text-xs text-ink-3">Gap เฉลี่ย (ระดับ) · จำนวนพนักงานที่มี Gap</span>}>Top 5 ทักษะที่องค์กรต้องพัฒนา → ใช้วางแผนหลักสูตรใน LMS</CardTitle>
          <ul className="space-y-3">
            {a.skillGaps.map((s) => (
              <li key={s.name} className="grid grid-cols-[140px_1fr_120px] sm:grid-cols-[220px_1fr_160px] items-center gap-3 text-sm">
                <span className="text-ink-2 truncate">{s.name}</span>
                <div className="h-5 rounded-md bg-[#eef2f7] relative"><div className="absolute inset-y-0 left-0 rounded-md bg-[#2a78d6]" style={{ width: `${(s.gap / 1.5) * 100}%` }} /></div>
                <span className="text-right text-xs text-ink-2"><b className="text-ink">{s.gap}</b> ระดับ · {fmt(s.people)} คน</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
