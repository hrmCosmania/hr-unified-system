import { Link } from "react-router-dom";
import { ChevronRight, ClipboardCheck, MessagesSquare, MessageSquareHeart, Target, GraduationCap, Users, Radar as RadarIcon, ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { useStore, person } from "../data/store";
import { competencies, cycle, readiness, todosByRole, team, badges, careerPath } from "../data/mock";
import { Avatar, Card, CardTitle, Progress, Stepper, cx, thDate } from "../components/ui";
import { Donut } from "../components/charts";
import { MountainArt } from "../components/Art";
import type { Todo } from "../data/types";

const todoIcon: Record<Todo["kind"], { icon: React.ReactNode; bg: string }> = {
  goal: { icon: <Target size={18} />, bg: "bg-brand-50 text-brand-600" },
  approve: { icon: <Target size={18} />, bg: "bg-brand-50 text-brand-600" },
  checkin: { icon: <MessagesSquare size={18} />, bg: "bg-[#fff1e6] text-[#c4501f]" },
  review: { icon: <ClipboardCheck size={18} />, bg: "bg-crit-bg text-crit" },
  "360": { icon: <RadarIcon size={18} />, bg: "bg-[#f1eefc] text-[#6250d6]" },
  feedback: { icon: <MessageSquareHeart size={18} />, bg: "bg-[#fdeef4] text-[#c2416f]" },
  idp: { icon: <GraduationCap size={18} />, bg: "bg-leaf-50 text-leaf-600" },
};

export default function Home() {
  const { me, role, goals, feedback } = useStore();
  const todos = todosByRole[role === "employee" ? "employee" : "manager"];
  const counts = {
    on: goals.filter((g) => ["on_track", "approved", "completed"].includes(g.status)).length,
    risk: goals.filter((g) => g.status === "at_risk").length,
    off: goals.filter((g) => g.status === "off_track").length,
    draft: goals.filter((g) => ["draft", "pending_approval"].includes(g.status)).length,
  };
  const avg = Math.round(goals.reduce((s, g) => s + Math.min(100, progressOf(g)) * g.weight, 0) / Math.max(1, goals.reduce((s, g) => s + g.weight, 0)));
  const gaps = [...competencies].sort((a, b) => b.required - b.current - (a.required - a.current)).slice(0, 3);
  const current = cycle.phases.findIndex((p) => p.state === "current");
  const latestPraise = feedback.filter((f) => f.toId === "me" && f.type === "praise").slice(0, 2);
  const firstName = me.name.split(" ")[0];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-[#eaf2fc] via-[#f1f6fd] to-[#e6f0fb] min-h-[132px]">
        <MountainArt className="absolute right-0 bottom-0 h-full w-[62%] sm:w-[52%]" />
        <div className="relative p-6 sm:p-7 max-w-[60%]">
          <h1 className="font-display text-[22px] sm:text-[26px] font-semibold text-navy-800">สวัสดีครับ คุณ{firstName} 👋</h1>
          <p className="text-ink-2 mt-1 text-sm sm:text-[15px]">มาร่วมสร้างผลงานที่ดีขึ้นในวันนี้กันครับ</p>
          <p className="hidden sm:block mt-3 text-[13px] text-ink-3">{me.position} · {me.orgUnit}</p>
        </div>
        <p className="absolute right-5 top-4 font-display italic text-navy-700/80 text-sm sm:text-lg hidden sm:block">Small Steps, Big Progress</p>
      </section>

      {/* Cycle timeline */}
      <Card className="p-5">
        <CardTitle action={<span className="text-xs text-ink-3">วันนี้ {thDate("2026-11-24")}</span>}>{cycle.name}</CardTitle>
        <Stepper current={current} steps={cycle.phases.map((p) => ({ label: p.label, sub: p.range }))} />
      </Card>

      {/* To-do */}
      <section>
        <h2 className="font-display text-base font-semibold text-navy-800 mb-3">งานที่ต้องทำตอนนี้</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {todos.map((t, i) => (
            <Link key={i} to={t.link} className="card p-4 flex items-center gap-3 hover:border-brand-200 hover:-translate-y-0.5 transition-all group">
              <span className={cx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", todoIcon[t.kind].bg)}>{todoIcon[t.kind].icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink truncate">{t.title}</span>
                <span className={cx("block text-xs truncate", t.urgent ? "text-crit" : "text-ink-3")}>{t.subtitle}</span>
              </span>
              <ChevronRight size={18} className="text-ink-3 group-hover:text-brand-600" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Goal status */}
        <Card className="p-5">
          <CardTitle action={<Link to="/goals" className="text-xs text-brand-600 hover:underline">ดูทั้งหมด</Link>}>สถานะเป้าหมาย</CardTitle>
          <div className="flex items-center gap-5">
            <Donut size={136} thickness={15}
              segments={[
                { label: "ตามเป้า", value: counts.on, color: "#1fa463" },
                { label: "ต้องดูแล", value: counts.risk, color: "#fab219" },
                { label: "เสี่ยง", value: counts.off, color: "#d03b3b" },
                { label: "ยังไม่อนุมัติ", value: counts.draft, color: "#b8c4d4" },
              ]}
              center={<><span className="font-display text-[26px] font-semibold text-navy-800 leading-none">{avg}%</span><span className="text-[11px] text-ink-3 mt-1">ความคืบหน้ารวม</span></>} />
            <ul className="space-y-2.5 text-sm flex-1">
              {[["ตามเป้า", counts.on, "#1fa463", "✓"], ["ต้องดูแล", counts.risk, "#fab219", "!"], ["เสี่ยง", counts.off, "#d03b3b", "▲"], ["ยังไม่อนุมัติ", counts.draft, "#b8c4d4", "–"]].map(([l, v, c, s]) => (
                <li key={l as string} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded text-[10px] font-bold text-white flex items-center justify-center" style={{ background: c as string }}>{s}</span>
                  <span className="flex-1 text-ink-2">{l}</span><b className="text-ink">{v}</b>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Skills to develop */}
        <Card className="p-5">
          <CardTitle action={<Link to="/career" className="text-xs text-brand-600 hover:underline">Gap analysis</Link>}>ทักษะที่ควรพัฒนา</CardTitle>
          <ul className="space-y-4">
            {gaps.map((c) => {
              const pct = Math.round((c.current / c.required) * 100);
              return (
                <li key={c.id}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="text-ink-2">{c.name}</span><span className="text-ink font-semibold">{c.current} / {c.required}</span></div>
                  <Progress value={pct} tone={pct < 70 ? "warn" : "brand"} />
                </li>
              );
            })}
          </ul>
          <Link to="/idp" className="mt-4 inline-flex items-center gap-1 text-[13px] text-brand-600 font-medium hover:underline">เพิ่มในแผนพัฒนา (IDP) <ArrowRight size={14} /></Link>
        </Card>

        {/* Career */}
        <Card className="p-5 flex flex-col">
          <CardTitle>เส้นทางความก้าวหน้า</CardTitle>
          <div className="flex items-center gap-3 rounded-xl bg-canvas p-3">
            <div className="w-11 h-11 rounded-xl bg-navy-800 text-white flex items-center justify-center"><TrendingUp size={20} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-3">ตำแหน่งถัดไป</p>
              <p className="font-display font-semibold text-navy-800">{readiness.target}</p>
            </div>
            <span className="font-display text-xl font-semibold text-leaf-600">{readiness.pct}%</span>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[11.5px] text-ink-3 overflow-hidden">
            {careerPath.slice(2, 5).map((s, i) => (
              <span key={s.title} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={12} className="shrink-0" />}
                <span className={cx("truncate", s.state === "current" && "text-brand-700 font-semibold")}>{s.title}</span>
              </span>
            ))}
          </div>
          <Progress value={readiness.pct} tone="leaf" className="mt-2" />
          <Link to="/career" className="mt-auto pt-4">
            <span className="w-full h-10 rounded-[10px] border border-brand-200 text-brand-700 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-brand-50">
              ดูรายละเอียดเส้นทางอาชีพ <ArrowRight size={15} />
            </span>
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recognition */}
        <Card className="p-5">
          <CardTitle icon={<Sparkles size={16} className="text-[#eda100]" />} action={<Link to="/feedback" className="text-xs text-brand-600 hover:underline">ทั้งหมด</Link>}>คำชื่นชมล่าสุด</CardTitle>
          <ul className="space-y-3">
            {latestPraise.map((f) => {
              const p = person(f.fromId);
              return (
                <li key={f.id} className="flex gap-3 rounded-xl border border-line p-3">
                  <Avatar p={p} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm"><b>{p.name}</b> <span className="text-ink-3 text-xs">· {thDate(f.createdAt, false)}</span></p>
                    {f.badge && <span className="inline-block mt-1 text-[11.5px] rounded-full bg-[#fff6e0] text-[#8a5a00] px-2 py-0.5">{badges[f.badge].emoji} {badges[f.badge].label}</span>}
                    <p className="text-[13.5px] text-ink-2 mt-1 line-clamp-2">{f.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Team snapshot (manager) or Check-in reminder */}
        {role !== "employee" ? (
          <Card className="p-5">
            <CardTitle icon={<Users size={16} className="text-brand-600" />} action={<Link to="/team" className="text-xs text-brand-600 hover:underline">ทีมของฉัน</Link>}>ภาพรวมทีม (8 คน)</CardTitle>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[["ประเมินตนเองแล้ว", `${team.filter((t) => t.selfScore).length}/8`], ["Check-in ใน 30 วัน", `${team.filter((t) => t.lastCheckin && t.lastCheckin > "2026-10-25").length}/8`], ["ต้องดูแล/เสี่ยง", `${team.filter((t) => t.health === "at_risk" || t.health === "off_track").length}`]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-canvas p-3"><p className="font-display text-xl font-semibold text-navy-800">{v}</p><p className="text-[11.5px] text-ink-3 mt-0.5">{l}</p></div>
              ))}
            </div>
            <div className="flex -space-x-2 mt-4">{team.map((t) => <Avatar key={t.id} p={t} size={32} />)}</div>
          </Card>
        ) : (
          <Card className="p-5">
            <CardTitle icon={<MessagesSquare size={16} className="text-brand-600" />}>Check-in ครั้งถัดไป</CardTitle>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-navy-800 text-white flex flex-col items-center justify-center">
                <span className="text-[11px] opacity-70">พ.ย.</span><span className="font-display text-2xl font-semibold leading-none">28</span>
              </div>
              <div>
                <p className="font-semibold">กับ คุณวิภาวดี ศรีสุข</p>
                <p className="text-sm text-ink-3">ศุกร์ · 14:00–14:30 · ห้องประชุมสาขา</p>
                <p className="text-[13px] text-ink-2 mt-1.5">หัวข้อแนะนำ: CSAT ช่วงเย็น, ความคืบหน้า IDP</p>
              </div>
            </div>
            <Link to="/checkin" className="mt-4 inline-flex items-center gap-1 text-[13px] text-brand-600 font-medium hover:underline">เตรียมหัวข้อพูดคุย <ArrowRight size={14} /></Link>
          </Card>
        )}
      </div>
    </div>
  );
}

export function progressOf(g: { target: number; actual: number | null; direction: string }) {
  if (g.actual === null || !g.target) return 0;
  return g.direction === "lower_better" ? Math.min(150, (g.target / g.actual) * 100) : (g.actual / g.target) * 100;
}
