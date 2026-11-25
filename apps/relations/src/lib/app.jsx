import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isDemo, HOST, hostSignOut } from './supabase'
import { list, rpc, update } from './api'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [session, setSession] = useState(isDemo ? { demo: true } : undefined)
  const [demoRole, setDemoRole] = useState('hr')
  const [state, setState] = useState({ loading: true })
  const [toastMsg, setToastMsg] = useState(null)

  // บริษัทที่ทำงาน (ร่วมกับระบบ HR รวมศูนย์ — /shared/company.js): แสดงเฉพาะพนักงานของบริษัทนั้น
  const [company, setCompany] = useState(() => window.HRUCompany?.get() || '')
  useEffect(() => window.HRUCompany?.onChange((c) => setCompany(c)), [])

  useEffect(() => {
    if (isDemo) return
    supabase.auth.getSession().then(({ data }) => {
      // ล็อกอินเดียว: ยังไม่ล็อกอิน → ไปล็อกอินที่ระบบ HR แล้วกลับมาหน้านี้
      if (!data.session) { location.replace(HOST.login + '?next=' + encodeURIComponent('/relations/' + location.hash)); return }
      setSession(data.session)
      window.HRUCompany?.ensure()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!session) return
    try {
      const [employees, departments, coreValues, badges] = await Promise.all([
        list('er_employees'), list('er_departments'), list('er_core_values', { order: 'sort_order', ascending: true }), list('er_badges')
      ])
      let me, role
      if (isDemo) {
        me = employees.find((e) => e.id === 'emp-me')
        role = 'hr'
      } else {
        const uid = session.user.id
        me = employees.find((e) => e.auth_user_id === uid) || null
        role = await rpc('er_my_role').catch(() => 'employee')
      }
      setState({ loading: false, employees, departments, coreValues, badges, me, role })
    } catch (e) {
      setState({ loading: false, error: e.message })
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2800)
  }, [])

  const value = useMemo(() => {
    // empById ครอบคลุมทุกบริษัท (หัวหน้างานอาจอยู่บริษัทในเครือ) · employees = เฉพาะบริษัทที่เลือก
    const empById = Object.fromEntries((state.employees || []).map((e) => [e.id, e]))
    const employees = company && !isDemo ? (state.employees || []).filter((e) => !e.company || e.company === company) : state.employees
    const deptById = Object.fromEntries((state.departments || []).map((d) => [d.id, d]))
    const cvById = Object.fromEntries((state.coreValues || []).map((d) => [d.id, d]))
    const badgeById = Object.fromEntries((state.badges || []).map((d) => [d.id, d]))
    const role = isDemo ? demoRole : state.role
    return {
      ...state, employees, allEmployees: state.employees, company, session, isDemo, role, isHR: role === 'hr', isManager: role === 'manager' || role === 'hr',
      demoRole, setDemoRole, empById, deptById, cvById, badgeById, reload: load, toast, toastMsg,
      signOut: () => (isDemo ? supabase?.auth.signOut() : hostSignOut()),
      /** บัญชี HR ที่ยังไม่ผูกกับรหัสพนักงาน: ผูกบัญชีนี้กับพนักงานที่เลือก (ทำครั้งเดียว) */
      linkMe: async (empId) => { await update('er_employees', { id: empId }, { auth_user_id: session.user.id }); await load() }
    }
  }, [state, session, demoRole, load, toast, toastMsg, company])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
