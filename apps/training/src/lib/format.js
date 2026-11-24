export const TODAY = new Date('2026-11-24')
export const CURRENT_YEAR = 2026

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const thMonth = (m) => TH_MONTHS[m]
export const fmtDate = (s) => {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}
export const fmtRange = (a, b) => (a === b ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`)
export const fmtNum = (n, d = 0) => (n == null || Number.isNaN(n) ? '-' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: d }))
export const fmtBaht = (n) => `฿${fmtNum(n)}`
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
export const fullName = (e) => (e ? `${e.first_name} ${e.last_name}` : '-')
export const yearsBetween = (a, b = TODAY) => (b - new Date(a)) / (365.25 * 864e5)

export const LABELS = {
  format: { classroom: 'Classroom', 'e-learning': 'e-Learning', blended: 'Blended', ojt: 'On-the-Job' },
  level: { basic: 'พื้นฐาน', intermediate: 'กลาง', advanced: 'สูง' },
  sessionStatus: { planned: 'วางแผน', open: 'เปิดรับสมัคร', full: 'เต็ม', ongoing: 'กำลังอบรม', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' },
  enrollStatus: { requested: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', attended: 'เข้าอบรมแล้ว', completed: 'ผ่าน', failed: 'ไม่ผ่าน', no_show: 'ไม่มาอบรม' },
  idpStatus: { draft: 'ร่าง', submitted: 'รออนุมัติ', approved: 'อนุมัติแล้ว', in_progress: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น' },
  itemStatus: { not_started: 'ยังไม่เริ่ม', in_progress: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', overdue: 'เลยกำหนด' },
  method: { training: 'อบรม (10%)', ojt: 'On-the-Job (70%)', coaching: 'Coaching (20%)', project: 'Project (70%)', self_learning: 'Self-learning (10%)' },
  compType: { core: 'Core', managerial: 'Managerial', functional: 'Functional', technical: 'Technical' },
  readiness: { ready_now: 'พร้อมทันที', '1_2_years': 'พร้อมใน 1–2 ปี', '3_plus_years': 'พร้อมใน 3 ปีขึ้นไป' },
  risk: { low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง' },
  track: { store: 'สายงานสาขา (Retail)', sales: 'สายงานขาย (FMCG)', supply_chain: 'Supply Chain', production: 'สายงานผลิต (Factory)', quality: 'สายงานคุณภาพ', maintenance: 'สายงานซ่อมบำรุง', support: 'สายงานสนับสนุน (HQ)' },
  role: { admin: 'ผู้ดูแลระบบ / HR Director', hr: 'เจ้าหน้าที่ HRD', manager: 'หัวหน้างาน', employee: 'พนักงาน' },
}

export const TONES = {
  requested: 'amber', approved: 'blue', rejected: 'rose', attended: 'teal', completed: 'green', failed: 'rose', no_show: 'slate',
  planned: 'slate', open: 'blue', full: 'amber', ongoing: 'violet', cancelled: 'slate',
  draft: 'slate', submitted: 'amber', in_progress: 'blue', not_started: 'slate', overdue: 'rose',
  ready_now: 'green', '1_2_years': 'blue', '3_plus_years': 'amber',
  low: 'green', medium: 'amber', high: 'rose',
  connected: 'green', warning: 'amber', disconnected: 'rose', success: 'green', partial: 'amber',
}

export const CATEGORY_COLORS = {
  Leadership: '#2f6fe4', Functional: '#14b8a6', 'Soft Skill': '#a855f7', Safety: '#f59e0b', Compliance: '#ef4444', Digital: '#0ea5e9',
}

export function downloadCSV(filename, rows) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '﻿' + [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
