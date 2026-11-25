import { createClient } from '@supabase/supabase-js'

// แอปย่อยของระบบ HR รวมศูนย์: ใช้ Supabase โปรเจกต์เดียวกัน (คีย์สาธารณะเดียวกับ payroll/js/config.js)
// storage key ค่าเริ่มต้น = session ล็อกอินเดียวกับระบบ HR (โดเมนเดียวกัน)
// เปิดด้วย ?demo=1 = โหมด Demo เดิม (ข้อมูลตัวอย่างในเบราว์เซอร์ ไม่แตะฐานข้อมูลจริง)
const HR_URL = 'https://zkqewnwulnugbhndtnkr.supabase.co'
const HR_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWV3bnd1bG51Z2JobmR0bmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTM5MjEsImV4cCI6MjEwMTQ4OTkyMX0.Rfo2492G7DtkhQuPfHCXCPX0jRIHUceRpDDd8AlHJh0'
const forceDemo = typeof location !== 'undefined' && /[?&]demo=1\b/.test(location.search)
const url = forceDemo ? '' : import.meta.env.VITE_SUPABASE_URL || HR_URL
const key = forceDemo ? '' : import.meta.env.VITE_SUPABASE_ANON_KEY || HR_KEY

export const supabase = url && key ? createClient(url, key) : null
export const isDemo = !supabase

// ระบบแม่ (HR รวมศูนย์): หน้าล็อกอิน / ปุ่มกลับ / คีย์แคชที่ล้างตอนออกจากระบบ
export const HOST = { home: '/#home', login: '/', clearKeys: ['cmncil_hr_unified_v1', 'plfl-'] }
export async function hostSignOut() {
  try { await supabase?.auth.signOut() } catch { /* ignore */ }
  try { Object.keys(localStorage).forEach((k) => { if (HOST.clearKeys.some((p) => k.startsWith(p))) localStorage.removeItem(k) }) } catch { /* ignore */ }
  location.href = HOST.login
}
