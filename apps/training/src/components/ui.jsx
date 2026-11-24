import { X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TONES } from '../lib/format'

export const cx = (...a) => a.filter(Boolean).join(' ')

export function Card({ className, children, title, action, pad = true }) {
  return (
    <section className={cx('rounded-2xl bg-white shadow-card ring-1 ring-slate-100', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h3 className="text-[15px] font-semibold text-navy-900">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, crumbs, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {crumbs && (
          <div className="mb-1 flex items-center gap-1 text-xs text-slate-400">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span>›</span>}
                {c.to ? <Link to={c.to} className="hover:text-brand-600">{c.label}</Link> : c.label}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const toneCls = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-200', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200', rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200', violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
}
export function Badge({ tone, status, children, className }) {
  const t = tone || TONES[status] || 'slate'
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', toneCls[t], className)}>{children}</span>
}

export function Button({ variant = 'primary', size = 'md', className, children, ...p }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
    ghost: 'text-brand-600 hover:bg-brand-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }[variant]
  const s = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
  return <button className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50', v, s, className)} {...p}>{children}</button>
}

export function Stat({ icon: Icon, label, value, unit, sub, tone = 'blue' }) {
  const bg = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600', rose: 'bg-rose-50 text-rose-600', teal: 'bg-teal-50 text-teal-600' }[tone]
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      {Icon && <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-xl', bg)}><Icon size={24} /></div>}
      <div className="min-w-0">
        <div className="truncate text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-navy-900">{value}{unit && <span className="ml-1 text-base font-semibold">{unit}</span>}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
    </div>
  )
}

export function Progress({ value, tone = 'blue', className }) {
  const c = { blue: 'bg-brand-500', green: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone]
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className={cx('h-full rounded-full', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Avatar({ emp, size = 36 }) {
  const initial = emp?.first_name?.[0] || '?'
  const hues = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700']
  const h = hues[(emp?.employee_code || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % hues.length]
  return <div className={cx('grid shrink-0 place-items-center rounded-full font-semibold', h)} style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</div>
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cx('-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition', value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
          {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div className={cx('w-full rounded-2xl bg-white shadow-2xl', wide ? 'max-w-4xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="font-semibold text-navy-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}
export const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
export const Input = (p) => <input className={inputCls} {...p} />
export const Select = ({ options, children, ...p }) => (
  <select className={inputCls} {...p}>
    {children}
    {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
)

export function Table({ columns, rows, empty = 'ไม่มีข้อมูล', onRowClick, max }) {
  const list = max ? rows.slice(0, max) : rows
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
            {columns.map((c) => <th key={c.key} className={cx('px-3 py-2.5 font-medium', c.className)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.id || i} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cx('border-b border-slate-50 last:border-0', onRowClick && 'cursor-pointer hover:bg-slate-50')}>
              {columns.map((c) => <td key={c.key} className={cx('px-3 py-2.5 align-middle', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
          {!list.length && <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400">{empty}</td></tr>}
        </tbody>
      </table>
      {max && rows.length > max && <div className="px-3 pt-3 text-xs text-slate-400">แสดง {max} จาก {rows.length.toLocaleString()} รายการ — ใช้ตัวกรองหรือค้นหาเพื่อจำกัดผลลัพธ์</div>}
    </div>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
      {Icon && <Icon size={40} className="mb-3 text-slate-300" />}
      <div className="font-medium text-slate-500">{title}</div>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  )
}

export function LevelDots({ value, max = 5, required }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cx('h-2.5 w-2.5 rounded-full', i < value ? (required && value < required ? 'bg-amber-400' : 'bg-brand-500') : required && i < required ? 'bg-slate-200 ring-1 ring-amber-300' : 'bg-slate-200')} />
      ))}
    </div>
  )
}
