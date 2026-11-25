import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useApp } from '../lib/app'
import { rpc } from '../lib/api'
import { Badge, PageHead, Person, Stat, thDate, tenureText, Empty } from '../components/ui'
import { STAGES, stageOf } from '../lib/journey'
import EmployeeDrawer from '../components/EmployeeDrawer'

export default function People() {
  const app = useApp()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('current')
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => app.employees.filter((e) => {
    if (status === 'current' && e.status === 'resigned') return false
    if (status !== 'current' && status !== 'all' && e.status !== status) return false
    if (dept && e.department_id !== dept) return false
    if (q) {
      const s = `${e.first_name} ${e.last_name} ${e.nickname || ''} ${e.employee_code} ${e.position_name || ''}`.toLowerCase()
      if (!s.includes(q.toLowerCase())) return false
    }
    return true
  }), [app.employees, q, dept, status])

  async function sync() {
    setBusy(true)
    try {
      const r = await rpc('er_sync_from_hrm')
      app.toast(r?.error || `ซิงก์สำเร็จ: เพิ่ม ${r.inserted} · อัปเดต ${r.updated} · ลาออก ${r.resigned}`)
      app.reload()
    } catch (e) { app.toast('ซิงก์ไม่สำเร็จ: ' + e.message) }
    setBusy(false)
  }

  const active = app.employees.filter((e) => e.status !== 'resigned')
  return (
    <div>
      <PageHead eyebrow="พนักงาน" title="ข้อมูลพนักงานและกลุ่มเป้าหมาย" sub="ข้อมูลพื้นฐานซิงก์อัตโนมัติจากระบบ HR Core — แก้ไขข้อมูลหลักที่ HR Core เท่านั้น">
        {app.isHR && <button className="btn btn-ghost" onClick={sync} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''} /> ซิงก์จาก HR Core</button>}
      </PageHead>

      <div className="grid g4 mb16">
        <Stat label="พนักงานปัจจุบัน" value={active.length} unit="คน" icon="Users" />
        <Stat label="ทดลองงาน" value={app.employees.filter((e) => e.status === 'probation').length} unit="คน" icon="DoorOpen" tone="amber" />
        <Stat label="หน่วยงาน" value={app.departments.length} icon="Building2" tone="violet" />
        <Stat label="อายุงานเฉลี่ย" value={(active.reduce((a, e) => a + (Date.now() - new Date(e.hire_date)) / 3.156e10, 0) / Math.max(1, active.length)).toFixed(1)} unit="ปี" icon="Hourglass" tone="green" />
      </div>

      <div className="card">
        <div className="card-pad row wrap" style={{ gap: 10 }}>
          <input className="input" style={{ maxWidth: 300 }} placeholder="ค้นหาชื่อ ชื่อเล่น รหัส ตำแหน่ง" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ maxWidth: 220 }} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">ทุกหน่วยงาน</option>
            {app.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="current">ปัจจุบัน</option><option value="probation">ทดลองงาน</option><option value="resigned">พ้นสภาพ</option><option value="all">ทั้งหมด</option>
          </select>
          <span className="small faint" style={{ marginLeft: 'auto' }}>{rows.length} คน</span>
        </div>
        {rows.length === 0 ? <Empty icon="SearchX" text="ไม่พบพนักงานที่ค้นหา" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>พนักงาน</th><th className="hide-sm">หน่วยงาน</th><th>ช่วง Journey</th><th className="hide-sm">เริ่มงาน</th><th className="hide-sm">อายุงาน</th><th>สถานะ</th></tr></thead>
              <tbody>
                {rows.slice(0, 150).map((e) => {
                  const st = STAGES.find((s) => s.key === stageOf(e))
                  return (
                    <tr key={e.id} className="clickable" onClick={() => setSel(e)}>
                      <td><Person emp={e} size={34} /></td>
                      <td className="small hide-sm">{app.deptById[e.department_id]?.name}</td>
                      <td><span className="badge" style={{ background: st.color + '1c', color: st.color }}>{st.label}</span></td>
                      <td className="small hide-sm">{thDate(e.hire_date)}</td>
                      <td className="small hide-sm">{tenureText(e.hire_date)}</td>
                      <td><Badge tone={e.status === 'resigned' ? 'gray' : e.status === 'probation' ? 'amber' : 'green'}>{{ active: 'ปฏิบัติงาน', probation: 'ทดลองงาน', resigned: 'พ้นสภาพ' }[e.status]}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {sel && <EmployeeDrawer emp={sel} onClose={() => setSel(null)} />}
    </div>
  )
}
