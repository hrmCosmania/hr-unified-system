import {
  ArrowLeft, Bell, BookOpen, CalendarCheck, ChevronDown, ClipboardCheck, GraduationCap, Home, LineChart, Link2, LogOut, Menu,
  Route as RouteIcon, Search, Settings, Sprout, Target, Trophy, Users, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { fullName, LABELS } from '../lib/format'
import { HOST } from '../lib/db'
import { useStore } from '../lib/store'
import { Avatar, cx } from './ui'

const NAV = [
  { to: '/', label: 'หน้าหลัก', icon: Home, end: true },
  { to: '/my', label: 'การเรียนรู้ของฉัน', icon: GraduationCap },
  { to: '/idp', label: 'แผนพัฒนาบุคลากร (IDP)', icon: Target },
  { to: '/courses', label: 'หลักสูตรและอบรม', icon: BookOpen },
  { to: '/training', label: 'จัดการการอบรม', icon: CalendarCheck, role: 'manager' },
  { to: '/career', label: 'เส้นทางความก้าวหน้า', icon: RouteIcon },
  { to: '/competency', label: 'ประเมินสมรรถนะ', icon: ClipboardCheck },
  { to: '/talent', label: 'Talent & Succession', icon: Trophy, role: 'manager' },
  { to: '/employees', label: 'พนักงาน', icon: Users, role: 'manager' },
  { to: '/reports', label: 'รายงานและวิเคราะห์', icon: LineChart, role: 'hr' },
  { to: '/integration', label: 'เชื่อมต่อระบบ HRM', icon: Link2, role: 'hr' },
  { to: '/settings', label: 'ตั้งค่าระบบ', icon: Settings, role: 'hr' },
]

export default function Layout() {
  const { me, isHR, isManager, signOut, data, idx, toast, isDemo, signIn } = useStore()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()

  const items = NAV.filter((n) => !n.role || (n.role === 'hr' ? isHR : isManager))
  const pending = useMemo(() => {
    if (!data || !me?.employee) return 0
    return data.enrollments.filter((e) => e.status === 'requested' && (isHR || idx.emp[e.employee_id]?.manager_id === me.employee.id)).length
  }, [data, idx, me, isHR])

  const results = useMemo(() => {
    if (q.trim().length < 2 || !data) return []
    const s = q.trim().toLowerCase()
    const emps = isManager ? data.employees.filter((e) => `${e.first_name} ${e.last_name} ${e.employee_code}`.toLowerCase().includes(s)).slice(0, 5).map((e) => ({ to: `/employees/${e.id}`, label: fullName(e), sub: `${e.employee_code} · ${idx.pos[e.position_id]?.name}`, kind: 'พนักงาน' })) : []
    const cs = data.courses.filter((c) => `${c.title} ${c.code} ${c.category}`.toLowerCase().includes(s)).slice(0, 5).map((c) => ({ to: `/courses/${c.id}`, label: c.title, sub: `${c.code} · ${c.category}`, kind: 'หลักสูตร' }))
    return [...cs, ...emps]
  }, [q, data, idx, isManager])

  const switchRole = async (role) => {
    // โหมดสาธิต: สลับมุมมองผู้ใช้งาน
    await signIn({ demoRole: role })
    setMenu(false)
    nav('/')
  }

  return (
    <div className="flex min-h-screen bg-[#f3f7fc]">
      {/* Sidebar */}
      <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gradient-to-b from-navy-800 to-navy-900 text-white transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Sprout className="text-emerald-300" size={24} /></div>
          <div>
            <div className="text-lg font-bold leading-tight">PeopleGrow</div>
            <div className="text-[11px] leading-tight text-blue-200">HRD Learning & Development</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        {!isDemo && (
          <a href={HOST.home} title="กลับไปหน้าเลือกหมวดงานของระบบ HR รวมศูนย์" className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-[13px] text-blue-100 hover:bg-white/10">
            <ArrowLeft size={16} />กลับระบบ HR
          </a>
        )}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition', isActive ? 'bg-brand-600 font-medium text-white shadow' : 'text-blue-100 hover:bg-white/10')}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="m-4 rounded-xl bg-white/5 p-4 text-sm italic leading-relaxed text-blue-100">
          “พัฒนาคน พัฒนาองค์กร<br />สู่อนาคตที่ยั่งยืน”
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div className="relative max-w-md flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setTimeout(() => setQ(''), 200)}
              placeholder="ค้นหาพนักงาน หลักสูตร…" className="w-full rounded-xl bg-slate-100 py-2 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-100" />
            {results.length > 0 && (
              <div className="absolute mt-1 w-full overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-100">
                {results.map((r) => (
                  <button key={r.to} onMouseDown={() => nav(r.to)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50">
                    <div className="min-w-0"><div className="truncate text-sm font-medium">{r.label}</div><div className="truncate text-xs text-slate-400">{r.sub}</div></div>
                    <span className="text-[11px] text-slate-400">{r.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isDemo && <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 md:inline">โหมดสาธิต</span>}
          {!isDemo && <CompanyChip />}
          <button onClick={() => nav(isManager ? '/training?tab=approve' : '/my')} className={cx('relative rounded-full p-2 text-slate-500 hover:bg-slate-100', isDemo && 'ml-auto')} title="รายการรออนุมัติ">
            <Bell size={20} />
            {pending > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{pending > 99 ? '99+' : pending}</span>}
          </button>
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100">
              <Avatar emp={me?.employee} />
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold leading-tight">{me?.employee ? `คุณ${me.employee.first_name}` : me?.email}</div>
                <div className="text-[11px] leading-tight text-slate-400">{LABELS.role[me?.role]}</div>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {menu && (
              <div className="absolute right-0 mt-1 w-64 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-100" onMouseLeave={() => setMenu(false)}>
                {me?.employee && <button onClick={() => { setMenu(false); nav(`/employees/${me.employee.id}`) }} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50">โปรไฟล์และเส้นทางการพัฒนา</button>}
                {isDemo && (
                  <div className="border-t border-slate-100 px-4 py-2">
                    <div className="mb-1 text-xs text-slate-400">สลับมุมมอง (โหมดสาธิต)</div>
                    {['admin', 'manager', 'employee'].map((r) => (
                      <button key={r} onClick={() => switchRole(r)} className={cx('block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50', me?.role === r && 'font-semibold text-brand-700')}>{LABELS.role[r]}</button>
                    ))}
                  </div>
                )}
                <button onClick={signOut} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><LogOut size={16} />ออกจากระบบ</button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8"><Outlet /></main>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200/70 px-8 py-3 text-xs text-slate-400">
          <span>ลงทุนในการพัฒนาคน คือการลงทุนที่คุ้มค่าที่สุด</span>
          <span>Better People · Better Skills · A Stronger Tomorrow</span>
        </footer>
      </div>

      {toast && (
        <div className={cx('fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl', toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600')}>{toast.msg}</div>
      )}
    </div>
  )
}

/** บริษัทที่ทำงาน + ปุ่มเปลี่ยนบริษัท (ร่วมกับระบบ HR รวมศูนย์ — /shared/company.js) */
function CompanyChip() {
  const ref = useRef(null)
  useEffect(() => { if (window.HRUCompany && ref.current) window.HRUCompany.mount(ref.current) }, [])
  return <div ref={ref} className="ml-auto flex items-center text-slate-700" />
}
