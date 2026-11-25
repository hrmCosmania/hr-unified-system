// Data access layer: ทำงานกับ Supabase จริง หรือ in-memory Demo ด้วย API เดียวกัน
import { supabase, isDemo } from './supabase'
import { buildDemo } from './demo'

const KEY = 'peopleconnect-demo-v1'
let mem = null
function db() {
  if (mem) return mem
  try { const s = localStorage.getItem(KEY); if (s) mem = JSON.parse(s) } catch { /* ignore */ }
  if (!mem) mem = buildDemo()
  return mem
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* ignore */ } }
export function resetDemo() { mem = buildDemo(); save() }

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2))
const matches = (row, m) => Object.entries(m || {}).every(([k, v]) => row[k] === v)

export async function list(table, { eq, order, ascending = false, limit, select = '*' } = {}) {
  if (!isDemo) {
    let q = supabase.from(table).select(select)
    Object.entries(eq || {}).forEach(([k, v]) => { q = q.eq(k, v) })
    if (order) q = q.order(order, { ascending })
    if (limit) q = q.limit(limit)
    const { data, error } = await q
    if (error) throw error
    return data
  }
  let rows = (db()[table] || []).filter((r) => matches(r, eq))
  if (order) rows = [...rows].sort((a, b) => (a[order] > b[order] ? 1 : -1) * (ascending ? 1 : -1))
  return limit ? rows.slice(0, limit) : rows
}

export async function insert(table, row) {
  if (!isDemo) {
    const { data, error } = await supabase.from(table).insert(row).select()
    if (error) throw error
    return data?.[0]
  }
  const r = { id: uuid(), created_at: new Date().toISOString(), ...row }
  db()[table] = [r, ...(db()[table] || [])]
  save()
  return r
}

export async function update(table, match, patch) {
  if (!isDemo) {
    let q = supabase.from(table).update(patch)
    Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v) })
    const { error } = await q
    if (error) throw error
    return
  }
  db()[table] = (db()[table] || []).map((r) => (matches(r, match) ? { ...r, ...patch } : r))
  save()
}

export async function remove(table, match) {
  if (!isDemo) {
    let q = supabase.from(table).delete()
    Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v) })
    const { error } = await q
    if (error) throw error
    return
  }
  db()[table] = (db()[table] || []).filter((r) => !matches(r, match))
  save()
}

export async function rpc(name, args = {}) {
  if (!isDemo) {
    const { data, error } = await supabase.rpc(name, args)
    if (error) throw error
    return data
  }
  const fn = demoRpc[name]
  if (!fn) throw new Error('RPC not available in demo: ' + name)
  const out = fn(db(), args)
  save()
  return out
}

// ---------- Demo RPC (ทำงานเหมือนฟังก์ชันใน 003_er_integration_rpc.sql) ----------
const ME = 'emp-me'
const demoRpc = {
  er_submit_survey(t, { p_survey, p_answers }) {
    const s = t.er_surveys.find((x) => x.id === p_survey)
    if (!s || s.status !== 'open') throw new Error('แบบสำรวจนี้ปิดรับคำตอบแล้ว')
    if (t.er_survey_participation.some((p) => p.survey_id === p_survey && p.employee_id === ME)) throw new Error('คุณตอบแบบสำรวจนี้แล้ว')
    const me = t.er_employees.find((e) => e.id === ME)
    t.er_survey_participation.push({ survey_id: p_survey, employee_id: ME, submitted_at: new Date().toISOString() })
    const r = { id: uuid(), survey_id: p_survey, employee_id: s.is_anonymous ? null : ME, department_id: me.department_id, tenure_band: '5y+', submitted_on: new Date().toISOString().slice(0, 10) }
    t.er_survey_responses.push(r)
    p_answers.forEach((a) => t.er_survey_answers.push({ response_id: r.id, question_id: a.question_id, score: a.score ?? null, answer_text: a.text || null }))
    return true
  },
  er_survey_results(t, { p_survey }) {
    const s = t.er_surveys.find((x) => x.id === p_survey)
    const resps = t.er_survey_responses.filter((r) => r.survey_id === p_survey)
    const rid = new Set(resps.map((r) => r.id))
    const ans = t.er_survey_answers.filter((a) => rid.has(a.response_id))
    const qs = t.er_survey_questions.filter((q) => q.survey_id === p_survey).sort((a, b) => a.seq - b.seq)
    const questions = qs.filter((q) => q.q_type !== 'text').map((q) => {
      const sc = ans.filter((a) => a.question_id === q.id && a.score != null).map((a) => a.score)
      const n = sc.length
      const fav = q.q_type === 'likert' ? sc.filter((x) => x >= 4).length : sc.filter((x) => x >= 9).length
      return {
        id: q.id, text: q.text, dimension: q.dimension, q_type: q.q_type, n,
        avg: n ? +(sc.reduce((a, b) => a + b, 0) / n).toFixed(2) : null,
        favorable: n ? +((100 * fav) / n).toFixed(1) : null,
        enps: q.q_type === 'nps' && n ? Math.round((100 * (sc.filter((x) => x >= 9).length - sc.filter((x) => x <= 6).length)) / n) : null
      }
    })
    const likertIds = new Set(qs.filter((q) => q.q_type === 'likert').map((q) => q.id))
    const by_department = t.er_departments.map((d) => {
      const rs = resps.filter((r) => r.department_id === d.id)
      const ids = new Set(rs.map((r) => r.id))
      const sc = ans.filter((a) => ids.has(a.response_id) && likertIds.has(a.question_id))
      return { department: d.name, n: rs.length, favorable: sc.length ? +((100 * sc.filter((a) => a.score >= 4).length) / sc.length).toFixed(1) : null }
    }).filter((x) => x.n >= (s?.min_group_size || 5))
    const comments = ans.filter((a) => a.answer_text).map((a) => a.answer_text)
    return { responses: resps.length, invited: t.er_employees.filter((e) => e.status !== 'resigned').length, questions, by_department, comments }
  },
  er_submit_feedback(t, { p_type, p_category, p_subject, p_body, p_anonymous }) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase()
    t.er_feedback.unshift({ id: uuid(), feedback_type: p_type, category: p_category, subject: p_subject, body: p_body, is_anonymous: p_anonymous,
      employee_id: p_anonymous ? null : ME, status: 'new', response: null, upvotes: 0, ref_code: code, created_at: new Date().toISOString() })
    return code
  },
  er_feedback_lookup(t, { p_code }) {
    const f = t.er_feedback.find((x) => x.ref_code === String(p_code).trim().toUpperCase())
    return f ? { subject: f.subject, status: f.status, response: f.response, responded_at: f.responded_at, created_at: f.created_at } : null
  },
  er_lnd_summary(t, { p_employee }) {
    const n = p_employee.length
    return { connected: true, courses: 4 + (n % 5), completed: 3 + (n % 4), hours: 18 + (n % 7) * 3, certificates: 1 + (n % 3),
      idp_status: 'approved', idp_goal: 'พัฒนาทักษะ People Analytics และ Leadership',
      upcoming: [{ title: 'Coaching for Leaders', start_date: '2026-12-08' }, { title: 'Data-driven HR', start_date: '2027-01-15' }] }
  },
  er_perf_summary(t, { p_employee }) {
    const n = p_employee.length
    return { connected: true, goals: 4 + (n % 3), avg_progress: 62 + (n % 30), feedback: 3 + (n % 6) }
  },
  er_sync_from_hrm(t) {
    t.er_integrations = t.er_integrations.map((i) => (i.system_code === 'HR_CORE' ? { ...i, last_sync_at: new Date().toISOString(), records: t.er_employees.length, status: 'connected' } : i))
    t.er_sync_logs.unshift({ id: uuid(), system_code: 'HR_CORE', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), status: 'success', inserted: 0, updated: t.er_employees.length, message: 'ซิงก์จากระบบ HR Core (hr_db)' })
    return { inserted: 0, updated: t.er_employees.length, resigned: 0, linked: 0 }
  },
  er_wellbeing_trend() {
    return Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 1}`, mood: +(3.5 + Math.sin(i / 2) * 0.3 + i * 0.03).toFixed(2), stress: +(2.9 - Math.cos(i / 3) * 0.25 - i * 0.02).toFixed(2), n: 120 + i * 4 }))
  }
}

export { isDemo }
