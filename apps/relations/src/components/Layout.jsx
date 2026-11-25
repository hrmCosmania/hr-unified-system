import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, Menu, LogOut, Lock, RotateCcw, CheckCircle2 } from 'lucide-react'
import { useApp } from '../lib/app'
import { resetDemo } from '../lib/api'
import { HOST } from '../lib/supabase'
import { Avatar, Icon, fullName } from './ui'

export const NAV = [
  { group: 'ภาพรวม' },
  { to: '/', label: 'หน้าแรก', icon: 'Home' },
  { to: '/journey', label: 'People Journey', icon: 'Route' },
  { to: '/people', label: 'พนักงาน', icon: 'Users' },
  { group: 'Engage' },
  { to: '/news', label: 'สื่อสารองค์กร', icon: 'Megaphone' },
  { to: '/events', label: 'กิจกรรม & แคมเปญ', icon: 'CalendarHeart' },
  { to: '/surveys', label: 'ความผูกพัน & แบบสำรวจ', icon: 'HeartPulse' },
  { to: '/recognition', label: 'การยกย่องและรางวัล', icon: 'Star' },
  { to: '/wellbeing', label: 'สวัสดิการ & Wellbeing', icon: 'Leaf' },
  { to: '/culture', label: 'วัฒนธรรมองค์กร', icon: 'BookHeart' },
  { to: '/growth', label: 'การพัฒนาพนักงาน', icon: 'GraduationCap' },
  { group: 'Employee Relations' },
  { to: '/voice', label: 'รับฟังและช่วยเหลือ', icon: 'MessageCircleHeart' },
  { to: '/cases', label: 'ER Case Management', icon: 'ShieldAlert', hr: true },
  { to: '/analytics', label: 'รายงาน & Analytics', icon: 'BarChart3', hr: true },
  { to: '/settings', label: 'ตั้งค่า & การเชื่อมต่อ', icon: 'Settings', hr: true }
]

export function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="16" cy="18" r="9" fill="#3B5BFD" /><circle cx="32" cy="14" r="10" fill="#8B5CF6" /><circle cx="48" cy="18" r="9" fill="#EC4899" />
      <rect x="6" y="30" width="20" height="28" rx="10" fill="#3B5BFD" /><rect x="22" y="28" width="20" height="30" rx="10" fill="#8B5CF6" /><rect x="38" y="30" width="20" height="28" rx="10" fill="#EC4899" />
    </svg>
  )
}

export default function Layout({ children }) {
  const app = useApp()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  const roleLabel = { hr: 'HR / ER Admin', manager: 'หัวหน้างาน', employee: 'พนักงาน' }[app.role]
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Logo />
          <div>
            <div className="brand-name">PeopleConnect</div>
            <div className="brand-tag">Engage Today · Build Tomorrow</div>
          </div>
        </div>
        {!app.isDemo && <a href={HOST.home} className="nav-back" title="กลับไปหน้าเลือกหมวดงานของระบบ HR รวมศูนย์" style={{ display: 'block', margin: '0 14px 10px', padding: '8px 12px', borderRadius: 12, border: '1px solid rgba(100,116,139,.25)', fontSize: 13, textDecoration: 'none', color: 'inherit' }}>← กลับระบบ HR</a>}
        <nav className="nav" onClick={() => setOpen(false)}>
          {NAV.map((n, i) => n.group ? <div key={i} className="nav-group">{n.group}</div> : (
            (!n.hr || app.isHR) && (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon name={n.icon} size={18} /> <span>{n.label}</span>
                {n.hr && <Lock size={12} className="lock" />}
              </NavLink>
            )
          ))}
        </nav>
        <div className="sidebar-foot">
          <Avatar emp={app.me} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName(app.me)}</div>
            <div className="tiny faint">{app.me?.position_name || roleLabel}</div>
          </div>
          {!app.isDemo && <button className="icon-btn" style={{ width: 34, height: 34 }} title="ออกจากระบบ" onClick={app.signOut}><LogOut size={16} /></button>}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="เมนู"><Menu size={18} /></button>
          <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/people?q=${encodeURIComponent(q)}`) }}>
            <Search size={16} />
            <input placeholder="ค้นหาเพื่อนพนักงาน, กิจกรรม, ข่าวสาร…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div style={{ flex: 1 }} />
          {app.isDemo && (
            <div className="tabs hide-sm" title="สลับมุมมองเพื่อทดลองสิทธิ์การใช้งาน">
              {[['hr', 'มุมมอง HR'], ['employee', 'มุมมองพนักงาน']].map(([k, l]) => (
                <button key={k} className={`tab ${app.demoRole === k ? 'active' : ''}`} onClick={() => { app.setDemoRole(k); if (k !== 'hr' && NAV.find((n) => n.to === loc.pathname)?.hr) nav('/') }}>{l}</button>
              ))}
            </div>
          )}
          {!app.isDemo && <CompanyChip />}
          <button className="icon-btn" aria-label="การแจ้งเตือน" onClick={() => nav('/journey')}><Bell size={18} /><span className="dot" /></button>
          <Avatar emp={app.me} size={40} />
        </header>
        <main className="content">
          {app.isDemo && (
            <div className="demo-banner mb16">
              <b>โหมด Demo</b> ข้อมูลตัวอย่างเก็บในเบราว์เซอร์นี้เท่านั้น · เชื่อม Supabase จริงได้โดยใส่ค่าใน <code>.env.local</code>
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => { resetDemo(); window.location.reload() }}><RotateCcw size={14} /> รีเซ็ตข้อมูลตัวอย่าง</button>
            </div>
          )}
          {children}
        </main>
      </div>
      {open && <div className="overlay" style={{ zIndex: 25 }} onClick={() => setOpen(false)} />}
      {app.toastMsg && <div className="toast"><CheckCircle2 size={18} color="#34D399" /> {app.toastMsg}</div>}
    </div>
  )
}

/** บริษัทที่ทำงาน + ปุ่มเปลี่ยนบริษัท (ร่วมกับระบบ HR รวมศูนย์ — /shared/company.js) */
function CompanyChip() {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) window.HRUCompany?.mount(ref.current) }, [])
  return <div ref={ref} className="hide-sm" style={{ display: 'flex', alignItems: 'center', marginRight: 8 }} />
}
