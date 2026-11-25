import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  House, Target, MessagesSquare, MessageSquareHeart, ClipboardCheck, Radar, Route, GraduationCap, Users, Grid3x3,
  ChartColumn, Settings, Bell, Search, LogOut, Menu, X, ChevronDown, CircleCheck, TriangleExclamationPoint, Info, User, ArrowLeft, Database,
} from "lucide-react";
import { useStore } from "../data/store";
import type { Role } from "../data/types";
import { HOST, hosted, hostSignOut } from "../lib/supabase";
import { Avatar, cx } from "./ui";

export function Logo({ light = false, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg width={size === "lg" ? 40 : 30} height={size === "lg" ? 40 : 30} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? "#ffffff" : "#14335E"} />
        <path d="M16 25V14" stroke={light ? "#14335E" : "#fff"} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 15c0-5 3.5-8 9-8 0 5.5-3.5 8.5-9 8z" fill="#22B573" />
        <path d="M16 18c0-4-2.8-6.5-7.5-6.5 0 4.5 2.8 7 7.5 6.5z" fill="#7FD6A6" />
      </svg>
      <div className="leading-none">
        <div className={cx("font-display font-bold tracking-tight", size === "lg" ? "text-[28px]" : "text-[19px]", light ? "text-white" : "text-navy-800")}>
          Grow<span className="text-leaf-500">Together</span>
        </div>
        <div className={cx("text-[10px] tracking-wide mt-0.5", light ? "text-white/70" : "text-ink-3")}>People · Performance · Progress</div>
      </div>
    </div>
  );
}

type NavItem = { to: string; label: string; icon: ReactNode; roles?: Role[] };
const nav: { group: string; items: NavItem[] }[] = [
  {
    group: "ของฉัน", items: [
      { to: "/", label: "หน้าแรก", icon: <House size={18} /> },
      { to: "/goals", label: "เป้าหมาย", icon: <Target size={18} /> },
      { to: "/checkin", label: "Check-in", icon: <MessagesSquare size={18} /> },
      { to: "/feedback", label: "Feedback", icon: <MessageSquareHeart size={18} /> },
      { to: "/review", label: "แบบประเมิน", icon: <ClipboardCheck size={18} /> },
      { to: "/360", label: "360° Feedback", icon: <Radar size={18} /> },
      { to: "/career", label: "Competency & Career", icon: <Route size={18} /> },
      { to: "/idp", label: "แผนพัฒนา (IDP)", icon: <GraduationCap size={18} /> },
    ],
  },
  { group: "หัวหน้างาน", items: [{ to: "/team", label: "ทีมของฉัน", icon: <Users size={18} />, roles: ["manager", "hr"] }] },
  {
    group: "HR & ผู้บริหาร", items: [
      { to: "/calibration", label: "Calibration (9-Box)", icon: <Grid3x3 size={18} />, roles: ["hr"] },
      { to: "/analytics", label: "Analytics", icon: <ChartColumn size={18} />, roles: ["hr"] },
      { to: "/admin", label: "ตั้งค่าระบบ", icon: <Settings size={18} />, roles: ["hr"] },
    ],
  },
];

const roleLabel: Record<Role, string> = { employee: "พนักงาน", manager: "หัวหน้างาน", hr: "HR / ผู้บริหาร" };

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useStore();
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="เมนูหลัก">
      {nav.map((g) => {
        const items = g.items.filter((i) => !i.roles || i.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={g.group} className="mt-4">
            <p className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{g.group}</p>
            {items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === "/"} onClick={onNavigate}
                className={({ isActive }) => cx("flex items-center gap-3 px-3 h-10 rounded-[10px] text-[14px] mb-0.5 transition-colors",
                  isActive ? "bg-navy-800 text-white font-medium shadow-sm" : "text-ink-2 hover:bg-brand-50 hover:text-brand-700")}>
                {it.icon}{it.label}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

/** หน้าที่ใช้ข้อมูลจริงแล้ว (HR บันทึกแทนพนักงาน) — หน้าอื่นยังเป็นข้อมูลตัวอย่าง */
// ทุกหน้าใช้ข้อมูลจริงเมื่อเชื่อมฐานข้อมูลแล้ว · แถบ "บันทึกให้" แสดงในหน้าที่บันทึกข้อมูลรายคน
const LIVE_ROUTES = ["/", "/goals", "/checkin", "/review", "/feedback", "/360", "/idp", "/career", "/team", "/calibration", "/analytics", "/admin"];
const PER_PERSON = ["/goals", "/checkin", "/review", "/feedback", "/360", "/idp", "/career"];

/** บริษัทที่ทำงาน + ปุ่มเปลี่ยนบริษัท (ร่วมกับระบบ HR รวมศูนย์ — /shared/company.js) */
function CompanyChip() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) window.HRUCompany?.mount(ref.current); }, []);
  return <div ref={ref} className="hidden sm:flex items-center text-ink-2" />;
}

/** ปุ่มกลับไปหน้าเลือกหมวดงานของระบบ HR รวมศูนย์ */
function BackToHR() {
  if (!hosted) return null;
  return (
    <a href={HOST.home} title="กลับไปหน้าเลือกหมวดงานของระบบ HR รวมศูนย์"
      className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13px] text-ink-2 hover:bg-brand-50">
      <ArrowLeft size={16} />กลับระบบ HR
    </a>
  );
}

export default function Layout() {
  const { me, role, setRole, signOut, toasts, live, liveStatus, liveMessage, employees, subject, setSubjectId, account, maxRole, feedback } = useStore();
  const bell = liveStatus === "ready" ? feedback.filter((f) => f.toId === subject?.id && !f.isRead).length : 3;
  // มุมมองที่เลือกได้: ไม่เกินสิทธิ์จริงของบัญชี (HR ดูเป็นหัวหน้า/พนักงานได้ · พนักงานดูได้แค่ของตัวเอง)
  const RANKS: Role[] = ["employee", "manager", "hr"];
  const roles = (Object.keys(roleLabel) as Role[]).filter((r) => liveStatus !== "ready" || RANKS.indexOf(r) <= RANKS.indexOf(maxRole));
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const liveRoute = LIVE_ROUTES.includes(loc.pathname);
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-[248px] shrink-0 flex-col bg-white border-r border-line sticky top-0 h-screen">
        <div className="h-[68px] flex items-center px-5 border-b border-line"><Logo /></div>
        <BackToHR />
        <SideNav />
        <div className="m-3 rounded-xl bg-gradient-to-br from-leaf-50 to-brand-50 p-3.5 text-[12.5px] text-ink-2 border border-line">
          <p className="font-display font-semibold text-navy-800 text-sm">Small steps, big progress 🌱</p>
          <p className="mt-1">ทุก Check-in คือก้าวเล็ก ๆ สู่เป้าหมายใหญ่</p>
        </div>
      </aside>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40 bg-navy-900/40" onClick={() => setDrawer(false)}>
          <aside className="w-[270px] h-full bg-white flex flex-col fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="h-16 flex items-center justify-between px-4 border-b border-line">
              <Logo /><button onClick={() => setDrawer(false)} aria-label="ปิดเมนู" className="p-2"><X size={20} /></button>
            </div>
            <BackToHR />
            <SideNav onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-16 lg:h-[68px] sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-line flex items-center gap-3 px-4 lg:px-7">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-brand-50" onClick={() => setDrawer(true)} aria-label="เปิดเมนู"><Menu size={20} /></button>
          <div className="lg:hidden"><Logo /></div>
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md h-10 px-3 rounded-[10px] bg-canvas border border-line text-ink-3">
            <Search size={16} />
            <input className="bg-transparent outline-none text-sm flex-1 text-ink placeholder:text-ink-3" placeholder="ค้นหาพนักงาน / ตำแหน่ง / สาขา / โรงงาน" />
          </div>
          <div className="flex-1 md:hidden" />
          {!live && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-warn-bg text-warn font-medium" title="ยังไม่ได้เชื่อม Supabase — ใช้ข้อมูลตัวอย่าง">
              <Info size={12} />ข้อมูลตัวอย่าง
            </span>
          )}
          {hosted && <CompanyChip />}
          {liveStatus === "ready" && employees.length > 0 && (
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-3 min-w-0">
              <span className="hidden sm:inline whitespace-nowrap">{account && account.role === "employee" ? "พนักงาน" : "บันทึกให้"}</span>
              <select value={subject?.id ?? ""} onChange={(e) => setSubjectId(e.target.value)} title="เลือกพนักงานที่จะบันทึกเป้าหมาย / Check-in / แบบประเมินให้"
                className="h-8 max-w-[220px] rounded-lg border border-brand-200 bg-white px-2 text-ink text-[13px] cursor-pointer">
                {employees.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
              </select>
            </label>
          )}
          {roles.length > 1 && <label className="hidden sm:flex items-center gap-1.5 text-[12.5px] text-ink-3">
            มุมมอง
            <select value={role} onChange={(e) => { setRole(e.target.value as Role); navigate(e.target.value === "hr" ? "/analytics" : "/"); }}
              className="h-8 rounded-lg border border-line bg-white px-2 text-ink text-[13px] cursor-pointer">
              {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </select>
          </label>}
          <button className="relative p-2 rounded-lg hover:bg-brand-50 text-ink-2" aria-label={`การแจ้งเตือน ${bell} รายการ`} onClick={() => navigate("/feedback")}>
            <Bell size={20} />{bell > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-crit text-white text-[10px] font-semibold flex items-center justify-center">{bell}</span>}
          </button>
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-brand-50 cursor-pointer">
              <Avatar p={me} size={36} />
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-sm font-semibold text-ink">{me.name}</span>
                <span className="block text-[11.5px] text-ink-3">{me.position}</span>
              </span>
              <ChevronDown size={16} className="text-ink-3 hidden md:block" />
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-60 card p-2 z-40 fade-up" onMouseLeave={() => setMenu(false)}>
                <div className="px-3 py-2 border-b border-line mb-1">
                  <p className="text-sm font-semibold">{me.name}</p>
                  <p className="text-xs text-ink-3">{me.code} · {me.orgUnit}</p>
                  {account && <p className="text-xs text-brand-700 mt-1">สิทธิ์: {roleLabel[account.role]}{!account.employeeId && " · บัญชีนี้ยังไม่ผูกกับข้อมูลพนักงาน"}</p>}
                </div>
                <div className="sm:hidden px-3 py-2">
                  <p className="text-xs text-ink-3 mb-1">มุมมอง</p>
                  <select value={role} onChange={(e) => { setRole(e.target.value as Role); setMenu(false); }} className="input h-9 py-1">
                    {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                </div>
                <button onClick={() => { signOut(); if (hosted) hostSignOut(); else navigate("/login"); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-2 hover:bg-brand-50 cursor-pointer">
                  <LogOut size={16} />ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </header>

        <main key={loc.pathname} className="flex-1 px-4 lg:px-7 py-5 lg:py-7 pb-24 lg:pb-10 fade-up max-w-[1400px] w-full mx-auto">
          {liveStatus === "ready" && PER_PERSON.includes(loc.pathname) && subject && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-[13px] text-ink-2">
              <Database size={16} className="text-brand-600 shrink-0" />
              <span><b className="text-ink">ข้อมูลจริง</b> — กำลังบันทึกให้ <b className="text-ink">{subject.name}</b> ({subject.code}{subject.position ? ` · ${subject.position}` : ""}) · เปลี่ยนพนักงานได้ที่ช่อง “บันทึกให้” ด้านบน</span>
            </div>
          )}
          {!(liveStatus === "ready" && liveRoute) && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warn/30 bg-warn-bg px-4 py-2.5 text-[13px] text-ink-2">
              <Info size={16} className="text-warn shrink-0" />
              <span>{liveStatus === "ready"
                ? <><b className="text-ink">หน้านี้ยังเป็นข้อมูลตัวอย่าง</b> — หน้าที่ใช้ข้อมูลจริงแล้ว: เป้าหมาย, Check-in และแบบประเมิน</>
                : liveStatus === "not_exposed"
                  ? <><b className="text-ink">ยังเชื่อมฐานข้อมูล GrowTogether ไม่ได้</b> — ผู้ดูแลต้องเพิ่ม <code>pm</code> ที่ Supabase › Project Settings › Data API › Exposed schemas · ระหว่างนี้แสดงข้อมูลตัวอย่าง</>
                  : liveStatus === "error"
                    ? <><b className="text-ink">โหลดข้อมูลจริงไม่สำเร็จ</b> — {liveMessage} · ระหว่างนี้แสดงข้อมูลตัวอย่าง</>
                    : liveStatus === "checking"
                      ? <>กำลังเชื่อมฐานข้อมูล…</>
                      : <><b className="text-ink">ตัวอย่างหน้าจอ</b> — ข้อมูลในแอปนี้เป็นข้อมูลสาธิต</>}</span>
              {hosted && <a href={HOST.home} className="ml-auto text-brand-600 font-medium hover:underline">กลับระบบ HR</a>}
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line grid grid-cols-5 h-16 pb-[env(safe-area-inset-bottom)]" aria-label="เมนูด่วน">
        {[
          { to: "/", label: "หน้าแรก", icon: <House size={20} /> },
          { to: "/goals", label: "เป้าหมาย", icon: <Target size={20} /> },
          { to: "/checkin", label: "Check-in", icon: <MessagesSquare size={20} /> },
          { to: "/feedback", label: "Feedback", icon: <MessageSquareHeart size={20} /> },
          { to: "/career", label: "โปรไฟล์", icon: <User size={20} /> },
        ].map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === "/"}
            className={({ isActive }) => cx("flex flex-col items-center justify-center gap-0.5 text-[11px]", isActive ? "text-brand-600 font-semibold" : "text-ink-3")}>
            {it.icon}{it.label}
          </NavLink>
        ))}
      </nav>

      {/* Toasts */}
      <div className="fixed z-[70] bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("fade-up flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-lg text-white max-w-sm",
            t.tone === "crit" ? "bg-crit" : t.tone === "info" ? "bg-navy-800" : "bg-[#0f7a3f]")}>
            {t.tone === "crit" ? <TriangleExclamationPoint size={16} /> : <CircleCheck size={16} />}{t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
