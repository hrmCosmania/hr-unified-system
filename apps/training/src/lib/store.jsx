import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { deleteRow, HOST, insertRows, isDemo, loadAll, rpc, supabase, updateRow } from './db'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const DEMO_USER_KEY = 'peoplegrow.hrd.demoUser'

export function DataProvider({ children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(undefined) // undefined = checking
  const [toast, setToast] = useState(null)

  // ---------- auth ----------
  useEffect(() => {
    if (isDemo) {
      try { setSession(JSON.parse(sessionStorage.getItem(DEMO_USER_KEY) || 'null')) } catch { setSession(null) }
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session ? { authUserId: data.session.user.id, email: data.session.user.email } : null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ? { authUserId: s.user.id, email: s.user.email } : null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    setError(null)
    try { setData(await loadAll()) } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { if (session) reload() }, [session, reload])

  const signIn = async ({ email, password, demoRole, demoEmployeeId }) => {
    if (isDemo) {
      const s = { demo: true, role: demoRole, employeeId: demoEmployeeId }
      try { sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(s)) } catch { /* ignore */ }
      setSession(s)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  const signOut = async () => {
    if (isDemo) { try { sessionStorage.removeItem(DEMO_USER_KEY) } catch { /* ignore */ } setSession(null); return }
    // ออกจากระบบ = ออกจากระบบ HR รวมศูนย์ด้วย (session เดียวกัน) แล้วล้างแคชข้อมูลของระบบ HR ในเครื่อง
    await supabase.auth.signOut()
    try { Object.keys(localStorage).forEach((k) => { if (HOST.clearKeys.some((p) => k.startsWith(p))) localStorage.removeItem(k) }) } catch { /* ignore */ }
    location.href = HOST.login
  }

  // ---------- indexes ----------
  const idx = useMemo(() => {
    if (!data) return null
    const by = (arr) => Object.fromEntries(arr.map((r) => [r.id, r]))
    const group = (arr, k) => arr.reduce((m, r) => ((m[r[k]] ||= []).push(r), m), {})
    return {
      bu: by(data.business_units), dept: by(data.departments), pos: by(data.positions), emp: by(data.employees),
      comp: by(data.competencies), course: by(data.courses), session: by(data.training_sessions), trainer: by(data.trainers),
      idp: by(data.idps),
      enrollByEmp: group(data.enrollments, 'employee_id'), enrollBySession: group(data.enrollments, 'session_id'),
      sessionsByCourse: group(data.training_sessions, 'course_id'), assessByEmp: group(data.competency_assessments, 'employee_id'),
      reqByPos: group(data.position_competencies, 'position_id'), certByEmp: group(data.certificates, 'employee_id'),
      itemsByIdp: group(data.idp_items, 'idp_id'), idpByEmp: Object.fromEntries(data.idps.map((i) => [i.employee_id, i])),
      perfByEmp: group(data.performance_results, 'employee_id'),
      talentByEmp: Object.fromEntries(data.talent_reviews.map((r) => [r.employee_id, r])),
      reportsByMgr: group(data.employees, 'manager_id'),
      modulesByCourse: group(data.course_modules, 'course_id'),
      candByPlan: group(data.succession_candidates, 'plan_id'),
    }
  }, [data])

  // ---------- current user ----------
  const me = useMemo(() => {
    if (!data || !session) return null
    if (session.demo) {
      const posCode = (e) => data.positions.find((p) => p.id === e.position_id)?.code
      const byRole = {
        manager: () => data.employees.find((e) => posCode(e) === 'ST-SM' && data.employees.filter((x) => x.manager_id === e.id).length > 2),
        employee: () => data.employees.find((e) => posCode(e) === 'ST-SUP' && data.idps.some((i) => i.employee_id === e.id && i.status === 'in_progress')),
      }
      const emp = data.employees.find((e) => e.id === session.employeeId) || byRole[session.role]?.() || data.employees.find((e) => e.id === data._meta?.directorId) || data.employees[0]
      return { employee: emp, role: session.role || 'admin', email: emp?.email }
    }
    const emp = data.employees.find((e) => e.auth_user_id === session.authUserId) || null
    const role = data.user_roles.find((r) => r.auth_user_id === session.authUserId)?.role || 'employee'
    return { employee: emp, role, email: session.email }
  }, [data, session])

  // พนักงานที่ผู้ใช้มองเห็น: HR = ทั้งหมด, หัวหน้า = ทีมทั้งสายบังคับบัญชา, พนักงาน = ตนเอง
  const visibleEmpIds = useMemo(() => {
    if (!data || !me) return new Set()
    if (['admin', 'hr'].includes(me.role)) return new Set(data.employees.map((e) => e.id))
    const out = new Set(me.employee ? [me.employee.id] : [])
    if (me.role === 'manager' && me.employee) {
      const stack = [me.employee.id]
      while (stack.length) {
        const id = stack.pop()
        for (const r of idx.reportsByMgr[id] || []) if (!out.has(r.id)) { out.add(r.id); stack.push(r.id) }
      }
    }
    return out
  }, [data, idx, me])

  // ---------- รายชื่อพนักงานชุดเดียวกับระบบ HR ----------
  // ผู้ดูแล/HR เปิดแอป → ดึงพนักงาน หน่วยงาน ตำแหน่ง หัวหน้างาน จากฐานข้อมูลระบบ HR (hr_db) เข้าตาราง hrd_* (ครั้งละหนึ่งรอบต่อแท็บ)
  const [syncNote, setSyncNote] = useState('')
  useEffect(() => {
    if (isDemo || !data || !me || !['admin', 'hr'].includes(me.role)) return
    try { if (sessionStorage.getItem('hrd.synced')) return; sessionStorage.setItem('hrd.synced', '1') } catch { /* ignore */ }
    rpc('hrd_sync_from_hrm').then((res) => {
      if (res?.error) { setSyncNote('ดึงรายชื่อพนักงานจากระบบ HR ไม่สำเร็จ: ' + res.error); return }
      setSyncNote(`ซิงก์พนักงานจากระบบ HR แล้ว (เพิ่ม ${res?.inserted ?? 0} · อัปเดต ${res?.updated ?? 0})`)
      if ((res?.inserted || 0) + (res?.updated || 0) > 0) reload()
    }).catch((e) => setSyncNote('ดึงรายชื่อพนักงานจากระบบ HR ไม่สำเร็จ: ' + e.message))
  }, [data, me, reload])

  // ---------- mutations ----------
  const notify = (msg, type = 'success') => { setToast({ msg, type, at: Date.now() }); setTimeout(() => setToast((t) => (t && Date.now() - t.at > 2500 ? null : t)), 2800) }

  const insert = async (table, rows) => {
    const saved = await insertRows(table, Array.isArray(rows) ? rows : [rows])
    setData((d) => ({ ...d, [table]: [...d[table], ...saved] }))
    return saved
  }
  const update = async (table, id, patch) => {
    const saved = await updateRow(table, id, patch)
    setData((d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? { ...r, ...saved } : r)) }))
    return saved
  }
  const remove = async (table, id) => {
    await deleteRow(table, id)
    setData((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) }))
  }
  const safe = (fn) => async (...args) => {
    try { return await fn(...args) } catch (e) { notify(e.message, 'error'); throw e }
  }

  const value = {
    data, idx, error, session, me, isDemo, visibleEmpIds, reload, signIn, signOut, toast, notify, syncNote,
    insert: safe(insert), update: safe(update), remove: safe(remove),
    isHR: me && ['admin', 'hr'].includes(me.role),
    isManager: me && ['admin', 'hr', 'manager'].includes(me.role),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
