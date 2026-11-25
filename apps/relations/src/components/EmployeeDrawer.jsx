import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { list, rpc, update } from '../lib/api'
import { Avatar, Badge, Bar, Cover, Drawer, Icon, thDate, tenureText, fullName, ago } from './ui'
import { STAGES } from '../lib/journey'

export default function EmployeeDrawer({ emp, onClose }) {
  const app = useApp()
  const canSee = emp && (app.isHR || emp.id === app.me.id || emp.manager_id === app.me.id)
  const [d, reload] = useLoad(async () => {
    if (!emp) return null
    const [miles, recs, parts] = await Promise.all([
      canSee ? list('er_journey_milestones', { eq: { employee_id: emp.id } }) : [],
      list('er_recognitions', { eq: { to_employee_id: emp.id }, order: 'created_at' }),
      list('er_event_participants', { eq: { employee_id: emp.id } })
    ])
    const [lnd, perf] = canSee ? await Promise.all([rpc('er_lnd_summary', { p_employee: emp.id }).catch(() => null), rpc('er_perf_summary', { p_employee: emp.id }).catch(() => null)]) : [null, null]
    return { miles: miles.sort((a, b) => (a.due_date > b.due_date ? 1 : -1)), recs, parts, lnd, perf }
  }, [emp?.id])
  if (!emp) return null
  const mgr = app.empById[emp.manager_id]
  const points = (d?.recs || []).reduce((a, r) => a + (r.points || 0), 0)

  async function done(m) {
    await update('er_journey_milestones', { id: m.id }, { status: 'done', completed_at: new Date().toISOString() })
    app.toast('บันทึกว่าเสร็จแล้ว'); reload()
  }

  return (
    <Drawer open onClose={onClose}>
      <Cover theme="violet" height={110} variant={1} />
      <div style={{ padding: '0 24px 28px', marginTop: -40 }}>
        <div style={{ border: '4px solid #fff', borderRadius: '50%', display: 'inline-block' }}><Avatar emp={emp} size={78} /></div>
        <h2 style={{ fontSize: 21, marginTop: 8 }}>{fullName(emp)} {emp.nickname && <span className="faint" style={{ fontWeight: 500 }}>({emp.nickname})</span>}</h2>
        <p className="muted">{emp.position_name} · {app.deptById[emp.department_id]?.name}</p>
        <div className="row wrap mt12">
          <Badge tone={emp.status === 'resigned' ? 'gray' : emp.status === 'probation' ? 'amber' : 'green'}>{{ active: 'ปฏิบัติงาน', probation: 'ทดลองงาน', resigned: 'พ้นสภาพ' }[emp.status]}</Badge>
          <Badge tone="blue" icon="Briefcase">อายุงาน {tenureText(emp.hire_date)}</Badge>
          <Badge tone="gray">{emp.employee_code}</Badge>
        </div>
        <div className="grid g3 mt16" style={{ gap: 10 }}>
          {[['เริ่มงาน', thDate(emp.hire_date)], ['หัวหน้า', mgr ? (mgr.nickname || mgr.first_name) : '-'], ['คะแนนชื่นชม', points + ' pts']].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 10 }}><div className="tiny faint">{l}</div><div className="bold small">{v}</div></div>
          ))}
        </div>

        {canSee && (
          <>
            <h3 className="card-title mt24 mb8">ข้อมูลจากระบบ HRM อื่นๆ</h3>
            <div className="grid g2" style={{ gap: 10 }}>
              <div className="card card-pad" style={{ padding: 14 }}>
                <div className="row small bold"><Icon name="GraduationCap" size={16} color="var(--green)" /> L&D</div>
                {d?.lnd?.connected ? <div className="small mt8">อบรม {d.lnd.completed}/{d.lnd.courses} หลักสูตร · {d.lnd.hours} ชม.<br />ใบรับรอง {d.lnd.certificates} ใบ · IDP: {d.lnd.idp_status || '-'}</div> : <div className="small faint mt8">ยังไม่เชื่อมต่อ</div>}
              </div>
              <div className="card card-pad" style={{ padding: 14 }}>
                <div className="row small bold"><Icon name="Target" size={16} color="var(--primary)" /> Performance</div>
                {d?.perf?.connected ? <div className="small mt8">เป้าหมาย {d.perf.goals ?? '-'} รายการ<br />ความคืบหน้าเฉลี่ย {d.perf.avg_progress ?? '-'}%</div> : <div className="small faint mt8">ยังไม่เชื่อมต่อ</div>}
                {d?.perf?.avg_progress != null && <div className="mt8"><Bar value={d.perf.avg_progress} /></div>}
              </div>
            </div>

            <h3 className="card-title mt24 mb8">เส้นทางพนักงาน (Journey)</h3>
            <div className="timeline">
              {(d?.miles || []).map((m) => {
                const st = STAGES.find((s) => s.key === m.stage)
                return (
                  <div key={m.id} className={`tl-item ${m.status}`}>
                    <div className="row between">
                      <div>
                        <div className="small bold">{m.title}</div>
                        <div className="tiny faint">{st?.label} · {thDate(m.due_date)} · ผู้รับผิดชอบ: {{ hr: 'HR', manager: 'หัวหน้า', employee: 'พนักงาน', buddy: 'Buddy' }[m.owner_role]}</div>
                      </div>
                      {m.status === 'done' ? <Badge tone="green">เสร็จแล้ว</Badge>
                        : <button className="btn btn-sm btn-soft" onClick={() => done(m)}>{m.status === 'overdue' ? 'เลยกำหนด · ทำแล้ว' : 'ทำแล้ว'}</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <h3 className="card-title mt24 mb8">คำชื่นชมที่ได้รับ ({d?.recs?.length || 0})</h3>
        {(d?.recs || []).slice(0, 4).map((r) => (
          <div key={r.id} className="kudos-card mb8" style={{ padding: 12 }}>
            <div className="tiny faint">จาก {app.empById[r.from_employee_id]?.nickname || app.empById[r.from_employee_id]?.first_name} · {ago(r.created_at)}</div>
            <div className="small mt8">{r.message}</div>
          </div>
        ))}
        <p className="small faint mt12">เข้าร่วมกิจกรรมองค์กร {d?.parts?.length || 0} ครั้ง</p>
      </div>
    </Drawer>
  )
}
