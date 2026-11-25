import { tenureYears } from '../components/ui'

export const STAGES = [
  { key: 'attract', label: 'Attract', th: 'ดึงดูด', icon: 'Magnet', color: '#94A3B8', theme: 'blue', card: 'Welcome to the Team', desc: 'Employer Branding · Pre-boarding (ข้อมูลจาก Recruitment)' },
  { key: 'onboard', label: 'Onboard', th: 'ต้อนรับ', icon: 'DoorOpen', color: '#F59E0B', theme: 'amber', card: 'Welcome to the Team', desc: 'Day 1 · Buddy · 30/60/90 · ผ่านทดลองงาน' },
  { key: 'develop', label: 'Develop', th: 'พัฒนา', icon: 'GraduationCap', color: '#14B8A6', theme: 'teal', card: 'Learning & Development', desc: 'IDP · Coaching · เชื่อมระบบ L&D' },
  { key: 'engage', label: 'Engage', th: 'ผูกพัน', icon: 'HeartHandshake', color: '#10B981', theme: 'green', card: 'Wellbeing & Work Life', desc: 'Recognition · กิจกรรม · ฉลองอายุงาน' },
  { key: 'retain', label: 'Retain', th: 'รักษา', icon: 'ShieldCheck', color: '#3B5BFD', theme: 'blue', card: 'Stay with Us', desc: 'Stay Interview · Career Growth · Talent' },
  { key: 'offboard', label: 'Offboard', th: 'อำลา', icon: 'Plane', color: '#8B5CF6', theme: 'violet', card: 'Farewell with Care', desc: 'Exit Interview · Handover · Alumni' }
]

export function stageOf(e) {
  if (e.status === 'resigned') return 'offboard'
  if (e.hire_date && new Date(e.hire_date) > new Date()) return 'attract'
  if (e.status === 'probation') return 'onboard'
  const y = tenureYears(e.hire_date)
  if (y < 1.5) return 'develop'
  if (y < 4) return 'engage'
  return 'retain'
}

