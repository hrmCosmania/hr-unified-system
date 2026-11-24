// Data layer — ทำงานได้ 2 โหมด
//   1) Supabase  : เมื่อกำหนด VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
//   2) Demo      : ใช้ข้อมูลตัวอย่าง (generateSeed) + บันทึกการเปลี่ยนแปลงไว้ใน localStorage
import { createClient } from '@supabase/supabase-js'
import { generateSeed } from './seed'

// แอปย่อยของระบบ HR รวมศูนย์: ใช้ Supabase โปรเจกต์เดียวกัน (คีย์สาธารณะ เหมือน payroll/js/config.js)
// createClient ใช้ storage key ค่าเริ่มต้น = session ล็อกอินเดียวกับระบบ HR (โดเมนเดียวกัน)
// เปิดด้วย ?demo=1 เพื่อดูโหมดสาธิต (ข้อมูลตัวอย่างในเครื่อง ไม่แตะฐานข้อมูลจริง)
const HR_URL = 'https://zkqewnwulnugbhndtnkr.supabase.co'
const HR_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWV3bnd1bG51Z2JobmR0bmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTM5MjEsImV4cCI6MjEwMTQ4OTkyMX0.Rfo2492G7DtkhQuPfHCXCPX0jRIHUceRpDDd8AlHJh0'
const forceDemo = typeof location !== 'undefined' && /[?&]demo=1\b/.test(location.search)
const url = forceDemo ? '' : import.meta.env.VITE_SUPABASE_URL || HR_URL
const key = forceDemo ? '' : import.meta.env.VITE_SUPABASE_ANON_KEY || HR_KEY
export const supabase = url && key ? createClient(url, key) : null
// ระบบแม่ (HR รวมศูนย์): หน้าล็อกอิน / ปุ่มกลับ / คีย์แคชที่ต้องล้างตอนออกจากระบบ
export const HOST = { name: 'ระบบ HR รวมศูนย์', home: '/#home', login: '/', clearKeys: ['cmncil_hr_unified_v1', 'plfl-'] }
export const isDemo = !supabase

export const TABLES = [
  'business_units', 'departments', 'positions', 'employees', 'user_roles', 'competencies',
  'position_competencies', 'competency_assessments', 'courses', 'course_competencies',
  'course_modules', 'trainers', 'training_sessions', 'enrollments', 'certificates', 'idps',
  'idp_items', 'career_paths', 'talent_reviews', 'succession_plans', 'succession_candidates',
  'performance_results', 'training_budgets', 'announcements', 'integrations', 'sync_logs',
]
const t = (name) => `hrd_${name}`
const pkOf = (table) => (table === 'course_competencies' ? null : table === 'user_roles' ? 'auth_user_id' : 'id')

// ---------------- Demo store ----------------
const OPS_KEY = 'peoplegrow.hrd.ops.v1'
const readOps = () => { try { return JSON.parse(localStorage.getItem(OPS_KEY) || '[]') } catch { return [] } }
const writeOps = (ops) => { try { localStorage.setItem(OPS_KEY, JSON.stringify(ops)) } catch { /* storage full / blocked */ } }

function applyOp(data, op) {
  const rows = data[op.table]
  if (!rows) return
  if (op.type === 'insert') rows.push(...op.rows)
  if (op.type === 'update') {
    const i = rows.findIndex((r) => r.id === op.id)
    if (i >= 0) rows[i] = { ...rows[i], ...op.patch }
  }
  if (op.type === 'delete') {
    const i = rows.findIndex((r) => r.id === op.id)
    if (i >= 0) rows.splice(i, 1)
  }
}

export function resetDemo() { writeOps([]) }

// ---------------- Public API ----------------
async function fetchAll(table) {
  const out = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(t(table)).select('*').range(from, from + size - 1)
    if (error) throw new Error(`${t(table)}: ${error.message}`)
    out.push(...data)
    if (data.length < size) break
  }
  return out
}

export async function loadAll() {
  if (isDemo) {
    const data = generateSeed()
    for (const op of readOps()) applyOp(data, op)
    return data
  }
  const entries = await Promise.all(TABLES.map(async (name) => [name, await fetchAll(name)]))
  return Object.fromEntries(entries)
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
}))

const stripComputed = (table, row) => {
  if (table !== 'talent_reviews') return row
  const { is_talent, ...rest } = row // eslint-disable-line no-unused-vars
  return rest
}

export async function insertRows(table, rows) {
  rows = rows.map((r) => (pkOf(table) === 'id' && !r.id ? { id: uid(), ...r } : r))
  if (isDemo) {
    writeOps([...readOps(), { type: 'insert', table, rows }])
    return rows
  }
  const { data, error } = await supabase.from(t(table)).insert(rows.map((r) => stripComputed(table, r))).select()
  if (error) throw new Error(error.message)
  return data
}

export async function updateRow(table, id, patch) {
  if (isDemo) {
    writeOps([...readOps(), { type: 'update', table, id, patch }])
    return { id, ...patch }
  }
  const { data, error } = await supabase.from(t(table)).update(stripComputed(table, patch)).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteRow(table, id) {
  if (isDemo) {
    writeOps([...readOps(), { type: 'delete', table, id }])
    return
  }
  const { error } = await supabase.from(t(table)).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function rpc(fn, args) {
  if (isDemo) throw new Error('ฟังก์ชันนี้ใช้ได้เมื่อเชื่อมต่อ Supabase แล้ว')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

// นำเข้าข้อมูลตัวอย่างไปยัง Supabase — ต้องเป็น admin/hr
// ฐานข้อมูลใช้ร่วมกับระบบ HR: นำเข้าได้เฉพาะคลังหลักสูตร/สมรรถนะ/วิทยากร (CATALOG) เท่านั้น
// พนักงาน หน่วยงาน ตำแหน่ง มาจากระบบ HR (hrd_sync_from_hrm) ห้ามใส่พนักงานตัวอย่างลงฐานข้อมูลจริง
export const CATALOG = ['competencies', 'courses', 'course_competencies', 'course_modules', 'trainers']
export async function pushSeedToSupabase(onProgress) {
  const data = generateSeed()
  const order = CATALOG
  for (const name of order) {
    let rows = data[name].map((r) => stripComputed(name, r))
    if (name === 'employees') {
      // self-reference: upsert without manager first, then upsert again with manager_id
      await chunked(name, rows.map((r) => ({ ...r, manager_id: null })), onProgress)
      await chunked(name, rows, onProgress)
      continue
    }
    await chunked(name, rows, onProgress)
  }
}
async function chunked(name, rows, onProgress) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(t(name)).upsert(rows.slice(i, i + 500))
    if (error) throw new Error(`${t(name)}: ${error.message}`)
    onProgress?.(`${t(name)} ${Math.min(i + 500, rows.length)}/${rows.length}`)
  }
}
