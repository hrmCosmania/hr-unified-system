import { CURRENT_YEAR, TODAY, yearsBetween } from './format'

const DONE = ['completed', 'attended']

export function sessionYear(s) { return new Date(s.start_date).getFullYear() }

// ชั่วโมงอบรมของพนักงานในปี
export function employeeHours(idx, empId, year = CURRENT_YEAR) {
  return (idx.enrollByEmp[empId] || []).reduce((sum, en) => {
    const s = idx.session[en.session_id]
    if (!s || sessionYear(s) !== year || !DONE.includes(en.status)) return sum
    return sum + Number(en.attended_hours || idx.course[s.course_id]?.hours || 0)
  }, 0)
}

// ระดับสมรรถนะล่าสุดของพนักงาน { competency_id: level }
export function currentLevels(idx, empId) {
  const out = {}
  for (const a of idx.assessByEmp[empId] || []) {
    if (!out[a.competency_id] || a.period > out[a.competency_id].period) out[a.competency_id] = a
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.final_level ?? v.manager_level ?? v.self_level ?? 0]))
}

// Skill gap เทียบกับตำแหน่ง (ปัจจุบันหรือเป้าหมาย)
export function competencyGap(idx, empId, positionId) {
  const emp = idx.emp[empId]
  const pid = positionId || emp?.position_id
  const levels = currentLevels(idx, empId)
  return (idx.reqByPos[pid] || []).map((pc) => {
    const current = levels[pc.competency_id] ?? 0
    return { competency: idx.comp[pc.competency_id], required: pc.required_level, current, gap: Math.max(0, pc.required_level - current) }
  }).sort((a, b) => b.gap - a.gap)
}

// หลักสูตรที่ผ่านแล้ว
export function completedCourseIds(idx, empId) {
  const set = new Set()
  for (const en of idx.enrollByEmp[empId] || []) if (en.status === 'completed') set.add(idx.session[en.session_id]?.course_id)
  return set
}

// แนะนำหลักสูตรจาก Skill Gap ของตำแหน่งปัจจุบัน + ตำแหน่งถัดไป
export function recommendCourses(data, idx, empId, limit = 5) {
  const emp = idx.emp[empId]
  if (!emp) return []
  const next = data.career_paths.find((p) => p.from_position_id === emp.position_id)
  const gaps = [...competencyGap(idx, empId), ...(next ? competencyGap(idx, empId, next.to_position_id) : [])].filter((g) => g.gap > 0)
  const gapByComp = {}
  for (const g of gaps) gapByComp[g.competency.id] = Math.max(gapByComp[g.competency.id] || 0, g.gap)
  const done = completedCourseIds(idx, empId)
  const bu = idx.bu[emp.business_unit_id]?.code
  const isNewHire = yearsBetween(emp.hire_date) < 1
  const scored = data.courses.filter((c) => c.status === 'published' && !done.has(c.id) && (!c.target_bu?.length || c.target_bu.includes(bu) || bu === 'HQ')
    && (isNewHire || !c.code.startsWith('ORI')))
    .map((c) => {
      const comps = data.course_competencies.filter((cc) => cc.course_id === c.id)
      const score = comps.reduce((s, cc) => s + (gapByComp[cc.competency_id] || 0), 0) + (c.is_mandatory ? 3 : 0)
      return { course: c, score, reasons: comps.filter((cc) => gapByComp[cc.competency_id]).map((cc) => idx.comp[cc.competency_id]?.name) }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

// ความพร้อมสู่ตำแหน่งถัดไป (0-100)
export function promotionReadiness(data, idx, empId, path) {
  const emp = idx.emp[empId]
  if (!emp || !path) return null
  const gaps = competencyGap(idx, empId, path.to_position_id)
  const compFit = gaps.length ? gaps.reduce((s, g) => s + Math.min(1, g.current / g.required), 0) / gaps.length : 0
  const done = completedCourseIds(idx, empId)
  const req = path.required_course_ids || []
  const courseFit = req.length ? req.filter((id) => done.has(id)).length / req.length : 1
  const tenure = Math.min(1, yearsBetween(emp.hire_date) / (path.min_years || 1))
  const perf = (idx.perfByEmp[empId] || []).find((p) => p.year === CURRENT_YEAR)
  const perfFit = perf ? (['A', 'B'].includes(perf.grade) ? 1 : perf.grade === 'C' ? 0.5 : 0) : 0.5
  const score = Math.round(compFit * 50 + courseFit * 25 + tenure * 15 + perfFit * 10)
  return { score, compFit, courseFit, tenure, perfFit, gaps, requiredCourses: req.map((id) => ({ course: idx.course[id], done: done.has(id) })) }
}

// ใบรับรองใกล้หมดอายุ
export function expiringCerts(data, days = 60) {
  const limit = new Date(TODAY); limit.setDate(limit.getDate() + days)
  return data.certificates.filter((c) => c.expires_at && new Date(c.expires_at) <= limit)
}

export function idpProgress(idx, idpId) {
  const items = idx.itemsByIdp[idpId] || []
  if (!items.length) return 0
  return Math.round(items.reduce((s, i) => s + (i.progress || 0), 0) / items.length)
}

// สถิติรายเดือน (ผู้เข้าอบรม / ชั่วโมง) ของปี
export function monthlyStats(data, idx, year = CURRENT_YEAR) {
  const m = Array.from({ length: 12 }, (_, i) => ({ month: i, trainees: 0, hours: 0, cost: 0 }))
  for (const s of data.training_sessions) {
    if (sessionYear(s) !== year) continue
    const mi = new Date(s.start_date).getMonth()
    const ens = (idx.enrollBySession[s.id] || []).filter((e) => DONE.includes(e.status) || e.status === 'failed')
    m[mi].trainees += ens.length
    m[mi].hours += ens.reduce((x, e) => x + Number(e.attended_hours || 0), 0)
    if (s.status !== 'cancelled' && new Date(s.start_date) <= TODAY) m[mi].cost += Number(s.cost || 0)
  }
  return m
}
