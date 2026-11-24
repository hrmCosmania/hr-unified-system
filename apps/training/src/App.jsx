import { Loader2 } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { HOST } from './lib/db'
import { useStore } from './lib/store'
import Career from './pages/Career'
import Competency from './pages/Competency'
import CourseDetail from './pages/CourseDetail'
import Courses from './pages/Courses'
import Dashboard from './pages/Dashboard'
import EmployeeProfile from './pages/EmployeeProfile'
import Employees from './pages/Employees'
import IDP from './pages/IDP'
import Integration from './pages/Integration'
import Login from './pages/Login'
import MyLearning from './pages/MyLearning'
import Reports from './pages/Reports'
import SessionDetail from './pages/SessionDetail'
import Settings from './pages/Settings'
import Talent from './pages/Talent'
import Training from './pages/Training'

function Guard({ need, children }) {
  const { isHR, isManager } = useStore()
  const ok = need === 'hr' ? isHR : need === 'manager' ? isManager : true
  return ok ? children : <Navigate to="/" replace />
}

export default function App() {
  const { session, data, error, reload, isDemo } = useStore()
  if (session === undefined) return null
  if (!session && !isDemo) {
    // ล็อกอินเดียว: ยังไม่ล็อกอิน → ไปล็อกอินที่ระบบ HR แล้วกลับมาหน้านี้
    location.replace(HOST.login + '?next=' + encodeURIComponent('/training/' + location.hash))
    return null
  }
  if (!session) return <Login />
  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-lg rounded-2xl bg-white p-6 text-center shadow-card">
          <div className="mb-2 text-lg font-semibold text-rose-600">โหลดข้อมูลไม่สำเร็จ</div>
          <p className="mb-4 break-words text-sm text-slate-500">{error}</p>
          <p className="mb-4 text-xs text-slate-400">ตรวจสอบว่ารัน migration ใน supabase/migrations แล้ว และบัญชีนี้มีสิทธิ์เข้าถึง</p>
          <button onClick={reload} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">ลองอีกครั้ง</button>
        </div>
      </div>
    )
  }
  if (!data) return <div className="grid min-h-screen place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="my" element={<MyLearning />} />
        <Route path="idp" element={<IDP />} />
        <Route path="idp/:id" element={<IDP />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="training" element={<Guard need="manager"><Training /></Guard>} />
        <Route path="training/sessions/:id" element={<Guard need="manager"><SessionDetail /></Guard>} />
        <Route path="career" element={<Career />} />
        <Route path="competency" element={<Competency />} />
        <Route path="talent" element={<Guard need="manager"><Talent /></Guard>} />
        <Route path="employees" element={<Guard need="manager"><Employees /></Guard>} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="reports" element={<Guard need="hr"><Reports /></Guard>} />
        <Route path="integration" element={<Guard need="hr"><Integration /></Guard>} />
        <Route path="settings" element={<Guard need="hr"><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
