import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/app'
import { Logo } from '../components/Layout'
import { Cover } from '../components/ui'

export default function Login({ notLinked }) {
  const app = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setMsg('เข้าสู่ระบบไม่สำเร็จ: ' + error.message)
  }
  async function magic() {
    if (!email) return setMsg('กรุณากรอกอีเมลก่อน')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setMsg(error ? error.message : 'ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว')
  }

  return (
    <div className="login-wrap">
      <Cover theme="blue" height="100%" style={{ borderRadius: 0 }} variant={2}>
        <div className="login-art" style={{ height: '100%' }}>
          <div className="row"><Logo size={40} /><span className="brand-name" style={{ color: '#fff' }}>PeopleConnect</span></div>
          <div>
            <div className="hero-script">Great People<br />Make a Greater Tomorrow</div>
            <p className="hero-sub">คนผูกพัน องค์กรเติบโตไปด้วยกัน · Employee Relation & Engagement Platform</p>
          </div>
          <p className="small" style={{ opacity: .8 }}>เชื่อมต่อ HR Core · Payroll · Time · Recruitment · L&D · Performance</p>
        </div>
      </Cover>
      <div className="login-form">
        <form onSubmit={submit} className="card card-pad" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
          <h2 style={{ fontSize: 24 }}>ยินดีต้อนรับ 👋</h2>
          <p className="muted mt8 mb16">เข้าสู่ระบบด้วยบัญชีเดียวกับระบบ HR อื่นๆ ขององค์กร</p>
          {notLinked && app.role === 'hr' && (
            <div className="mb16">
              <div className="demo-banner mb16">บัญชี HR นี้ยังไม่ผูกกับข้อมูลพนักงาน — เลือกชื่อของคุณจากรายชื่อพนักงาน (ทำครั้งเดียว) เพื่อใช้งานในนามของคุณ เช่น ผู้เขียนข่าว ผู้ให้คำชื่นชม</div>
              <div className="field"><label>ฉันคือ</label>
                <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">— เลือกพนักงาน —</option>
                  {(app.allEmployees || []).filter((e) => e.status !== 'resigned' && !e.auth_user_id).map((e) => <option key={e.id} value={e.id}>{e.employee_code} · {e.first_name} {e.last_name === '-' ? '' : e.last_name}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary btn-block" disabled={!pick || busy}
                onClick={async () => { setBusy(true); try { await app.linkMe(pick) } catch (err) { setMsg('ผูกบัญชีไม่สำเร็จ: ' + err.message) } setBusy(false) }}>ผูกบัญชีและเข้าใช้งาน</button>
              <button type="button" className="btn btn-ghost btn-block mt12" onClick={app.signOut}>ออกจากระบบ</button>
              {msg && <p className="small mt8" style={{ color: 'var(--red)' }}>{msg}</p>}
            </div>
          )}
          {notLinked && app.role !== 'hr' && (
            <div className="demo-banner mb16">บัญชีนี้ยังไม่ผูกกับข้อมูลพนักงาน (อีเมลต้องตรงกับในระบบ HR) กรุณาติดต่อ HR
              <button type="button" className="btn btn-sm btn-ghost" onClick={app.signOut}>ออกจากระบบ</button></div>
          )}
          {!notLinked && <>
          <div className="field"><label>อีเมลบริษัท</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label>รหัสผ่าน</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {msg && <p className="small mb16" style={{ color: 'var(--red)' }}>{msg}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
          <button type="button" className="btn btn-ghost btn-block mt12" onClick={magic}>ส่งลิงก์เข้าสู่ระบบทางอีเมล</button>
          </>}
        </form>
      </div>
    </div>
  )
}
