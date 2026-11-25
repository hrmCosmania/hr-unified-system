import { useEffect } from 'react'
import * as Icons from 'lucide-react'
import { X, Inbox } from 'lucide-react'

// ---------- helpers ----------
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const NOW = new Date('2026-11-25T12:00:00+07:00') > new Date() ? new Date('2026-11-25T12:00:00+07:00') : new Date()
export function thDate(d, withYear = true) {
  if (!d) return '-'
  const x = new Date(d)
  return `${x.getDate()} ${TH_MONTH[x.getMonth()]}${withYear ? ' ' + (x.getFullYear() + 543) : ''}`
}
export function thTime(d) {
  const x = new Date(d)
  return x.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
export function ago(d) {
  const s = (NOW - new Date(d)) / 1000
  if (s < 60) return 'เมื่อสักครู่'
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} วันที่แล้ว`
  return thDate(d)
}
export function daysUntil(d) { return Math.ceil((new Date(d) - NOW) / 86400000) }
export function tenureYears(hire) { return hire ? (NOW - new Date(hire)) / (365.25 * 86400000) : 0 }
export function tenureText(hire) {
  const y = tenureYears(hire)
  if (y < 1) return `${Math.max(0, Math.floor(y * 12))} เดือน`
  return `${Math.floor(y)} ปี ${Math.floor((y % 1) * 12)} เดือน`
}
export const fullName = (e) => (e ? `${e.first_name} ${e.last_name}` : '-')
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0)

// ---------- Icon by name ----------
export function Icon({ name, size = 18, ...p }) {
  const C = Icons[name] || Icons.Sparkles
  return <C size={size} {...p} />
}

const PALETTE = ['#3B5BFD', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#14B8A6', '#6366F1', '#F97316']
export function Avatar({ emp, size = 36 }) {
  const name = emp?.nickname || emp?.first_name || '?'
  const c = PALETTE[(emp?.employee_code || name).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length]
  return (
    <div className="avatar" style={{ width: size, height: size, background: `linear-gradient(135deg, ${c}, ${c}cc)`, fontSize: size * 0.38 }} title={fullName(emp)}>
      {emp?.avatar_url ? <img src={emp.avatar_url} alt="" /> : name.slice(0, 2)}
    </div>
  )
}

export function Person({ emp, sub, size = 36, deptById }) {
  return (
    <div className="row" style={{ minWidth: 0 }}>
      <Avatar emp={emp} size={size} />
      <div style={{ minWidth: 0 }}>
        <div className="bold" style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fullName(emp)}{emp?.nickname ? <span className="faint" style={{ fontWeight: 500 }}> ({emp.nickname})</span> : null}
        </div>
        <div className="small faint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sub ?? (emp?.position_name || '') + (deptById && emp?.department_id ? ' · ' + (deptById[emp.department_id]?.name || '') : '')}
        </div>
      </div>
    </div>
  )
}

export function Badge({ tone = 'blue', children, icon }) {
  return <span className={`badge b-${tone}`}>{icon ? <Icon name={icon} size={12} /> : null}{children}</span>
}

export function PageHead({ eyebrow, title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  )
}

export function Stat({ label, value, unit, delta, icon, tone = 'blue', foot }) {
  const bg = { blue: 'var(--primary-50)', violet: 'var(--violet-50)', pink: 'var(--pink-50)', green: 'var(--green-50)', amber: 'var(--amber-50)', red: 'var(--red-50)', teal: 'var(--teal-50)' }[tone]
  const fg = { blue: 'var(--primary)', violet: 'var(--violet)', pink: 'var(--pink)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', teal: 'var(--teal)' }[tone]
  return (
    <div className="card stat">
      <div className="row between">
        <div className="stat-label">{label}</div>
        {icon && <div className="ico" style={{ background: bg, color: fg }}><Icon name={icon} size={18} /></div>}
      </div>
      <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
      <div className="row small" style={{ marginTop: 2, minHeight: 18 }}>
        {delta != null && <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}{typeof delta === 'number' && !String(delta).includes('%') ? '' : ''}</span>}
        {foot && <span className="faint">{foot}</span>}
      </div>
    </div>
  )
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs">
      {items.map((it) => {
        const [k, label] = Array.isArray(it) ? it : [it, it]
        return <button key={k} className={`tab ${value === k ? 'active' : ''}`} onClick={() => onChange(k)}>{label}</button>
      })}
    </div>
  )
}

export function Modal({ open, onClose, title, sub, children, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3 style={{ fontSize: 19 }}>{title}</h3>
            {sub && <p className="muted small mt8">{sub}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, children }) {
  if (!open) return null
  return (
    <>
      <div className="overlay" style={{ display: 'block' }} onClick={onClose} />
      <div className="drawer">
        <button className="icon-btn" style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }} onClick={onClose} aria-label="ปิด"><X size={18} /></button>
        {children}
      </div>
    </>
  )
}

export function Empty({ icon = 'Inbox', text = 'ยังไม่มีข้อมูล', children }) {
  return (
    <div className="empty">
      <div className="ico"><Icon name={icon} size={22} /></div>
      <div>{text}</div>
      {children}
    </div>
  )
}

export function Bar({ value, color = 'var(--primary)', height = 8 }) {
  return <div className="bar" style={{ height }}><span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>
}

export function Ring({ value, size = 132, stroke = 12, color = 'var(--primary)', label, sub }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#edf0f8" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} style={{ transition: 'stroke-dashoffset .8s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="en" style={{ fontSize: size * 0.22, fontWeight: 800, lineHeight: 1 }}>{label ?? `${value}%`}</div>
          {sub && <div className="tiny faint mt8">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

// ---------- Generated cover art (แทนภาพถ่าย) ----------
const THEMES = {
  blue: ['#3B5BFD', '#7C9BFF', '#C7D2FE'], violet: ['#7C3AED', '#A78BFA', '#DDD6FE'], pink: ['#DB2777', '#F472B6', '#FBCFE8'],
  green: ['#059669', '#34D399', '#A7F3D0'], teal: ['#0D9488', '#2DD4BF', '#99F6E4'], amber: ['#D97706', '#FBBF24', '#FDE68A'],
  sunrise: ['#F97316', '#FDBA74', '#FDE68A']
}
export function Cover({ theme = 'blue', height = 140, icon, children, style, variant = 0 }) {
  const [a, b, c] = THEMES[theme] || THEMES.blue
  const gid = `g-${theme}-${variant}`
  return (
    <div className="cover" style={{ height, background: `linear-gradient(135deg, ${a}, ${b})`, ...style }}>
      <svg className="art" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={c} stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity=".12" /></linearGradient></defs>
        <circle cx={variant % 2 ? 330 : 80} cy="40" r="70" fill="#fff" opacity=".12" />
        <circle cx={variant % 2 ? 60 : 340} cy="170" r="90" fill="#fff" opacity=".08" />
        <path d={variant % 3 === 0 ? 'M0 150 Q 80 100 160 140 T 320 120 T 400 130 V200 H0Z' : variant % 3 === 1 ? 'M0 160 Q 100 110 200 150 T 400 120 V200 H0Z' : 'M0 140 L70 110 L140 150 L220 95 L300 140 L400 105 V200 H0Z'} fill={`url(#${gid})`} />
        <path d="M0 175 Q 120 145 240 172 T 400 160 V200 H0Z" fill="#fff" opacity=".16" />
      </svg>
      <div className="cover-inner">
        {icon && <div style={{ position: 'absolute', right: 16, bottom: 14, opacity: .9 }}><Icon name={icon} size={height > 120 ? 40 : 28} color="#fff" strokeWidth={1.6} /></div>}
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="tiny faint">{hint}</span>}
    </div>
  )
}

export function Loading() {
  return <div className="empty"><div className="ico"><Icons.Loader2 className="spin" size={22} /></div>กำลังโหลด…</div>
}

export { Inbox }
