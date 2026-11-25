import { useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { list, update } from '../lib/api'
import { Badge, Cover, Icon, PageHead, Person, Stat, Tabs, thDate, daysUntil, tenureYears, Empty } from '../components/ui'
import EmployeeDrawer from '../components/EmployeeDrawer'
import { STAGES, stageOf } from '../lib/journey'

const OWNER = { hr: 'HR', manager: 'หัวหน้างาน', employee: 'พนักงาน', buddy: 'Buddy' }

export default function Journey() {
  const app = useApp()
  const [stage, setStage] = useState('onboard')
  const [tab, setTab] = useState('todo')
  const [sel, setSel] = useState(null)
  const [miles, reload] = useLoad(() => list('er_journey_milestones'), [])

  const scopeIds = useMemo(() => {
    if (app.isHR) return null
    const team = app.employees.filter((e) => e.manager_id === app.me.id).map((e) => e.id)
    return new Set([app.me.id, ...team])
  }, [app.isHR, app.employees, app.me.id])

  const emps = app.employees.filter((e) => !scopeIds || scopeIds.has(e.id))
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, emps.filter((e) => stageOf(e) === s.key).length]))
  const stageMiles = (miles || []).filter((m) => m.stage === stage && (!scopeIds || scopeIds.has(m.employee_id)))
  const todo = stageMiles.filter((m) => m.status === 'pending' || m.status === 'overdue').filter((m) => daysUntil(m.due_date) <= 45).sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
  const overdue = (miles || []).filter((m) => m.status === 'overdue' && (!scopeIds || scopeIds.has(m.employee_id)))
  const inStage = new Set(emps.filter((e) => stageOf(e) === stage).map((e) => e.id))
  const cohortMiles = stageMiles.filter((m) => inStage.has(m.employee_id) && daysUntil(m.due_date) <= 0)
  const doneRate = cohortMiles.length ? Math.round((100 * cohortMiles.filter((m) => m.status === 'done').length) / cohortMiles.length) : 0
  const S = STAGES.find((s) => s.key === stage)
  const people = emps.filter((e) => stageOf(e) === stage)

  async function markDone(m) {
    await update('er_journey_milestones', { id: m.id }, { status: 'done', completed_at: new Date().toISOString() })
    app.toast('อัปเดต milestone แล้ว'); reload()
  }

  return (
    <div>
      <PageHead eyebrow="People Journey" title="ดูแลพนักงานตลอดเส้นทาง" sub="ตั้งแต่ก่อนเข้าทำงาน จนถึงวันอำลา — ทุกช่วงเวลาสำคัญไม่ถูกลืม (สร้าง milestone อัตโนมัติจาก HR Core)">
        <Badge tone="red" icon="AlarmClock">เลยกำหนด {overdue.length} รายการ</Badge>
      </PageHead>

      <div className="card card-pad">
        <div className="journey">
          {STAGES.map((s) => (
            <div key={s.key} className={`journey-step ${stage === s.key ? 'active' : ''}`} onClick={() => setStage(s.key)}>
              <div className="journey-dot" style={{ background: s.color }}><Icon name={s.icon} size={22} /></div>
              <div className="journey-name">{s.label}</div>
              <div className="tiny faint">{s.th} · {counts[s.key]} คน</div>
            </div>
          ))}
        </div>
        <div className="grid g6 mt24" style={{ gap: 12 }}>
          {STAGES.map((s, i) => (
            <div key={s.key} className="clickable" onClick={() => setStage(s.key)} style={{ opacity: stage === s.key ? 1 : 0.75 }}>
              <Cover theme={s.theme} height={96} icon={s.icon} variant={i} style={{ outline: stage === s.key ? '3px solid var(--primary)' : 'none', outlineOffset: 2 }} />
              <div className="small bold mt8 en">{s.card}</div>
              <div className="tiny faint">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g4 mt24">
        <Stat label={`พนักงานในช่วง ${S.label}`} value={counts[stage]} unit="คน" icon={S.icon} tone="blue" />
        <Stat label="Milestone ที่ถึงกำหนดแล้ว" value={cohortMiles.length} icon="ListChecks" tone="violet" foot="ของพนักงานในช่วงนี้" />
        <Stat label="ทำสำเร็จตามกำหนด" value={doneRate} unit="%" icon="CheckCircle2" tone="green" />
        <Stat label="ใกล้ถึง / เลยกำหนด" value={todo.length} icon="AlarmClock" tone="amber" foot="ภายใน 45 วัน" />
      </div>

      <div className="card mt24">
        <div className="card-pad row between wrap" style={{ paddingBottom: 0 }}>
          <div className="card-title">{S.label} · {S.th}</div>
          <Tabs value={tab} onChange={setTab} items={[['todo', 'งานที่ต้องทำ'], ['people', 'รายชื่อพนักงาน']]} />
        </div>
        <div className="card-pad">
          {stage === 'attract' && (
            <div className="demo-banner mb16" style={{ background: 'var(--primary-50)', borderColor: '#c7d2fe', color: 'var(--primary)' }}>
              <Icon name="Link" size={16} /> ช่วง Attract ดึงข้อมูลผู้สมัครที่ได้รับข้อเสนอจากระบบ Recruitment (ตั้งค่าที่ ตั้งค่า &amp; การเชื่อมต่อ)
            </div>
          )}
          {tab === 'todo' ? (
            todo.length === 0 ? <Empty icon="PartyPopper" text="ไม่มีงานค้างในช่วงนี้" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>พนักงาน</th><th>Milestone</th><th>กำหนด</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th /></tr></thead>
                  <tbody>
                    {todo.slice(0, 40).map((m) => {
                      const e = app.empById[m.employee_id]; const dd = daysUntil(m.due_date)
                      return (
                        <tr key={m.id}>
                          <td className="clickable" onClick={() => setSel(e)}><Person emp={e} size={32} deptById={app.deptById} /></td>
                          <td className="small bold">{m.title}</td>
                          <td className="small">{thDate(m.due_date)}</td>
                          <td><Badge tone="gray">{OWNER[m.owner_role]}</Badge></td>
                          <td><Badge tone={m.status === 'overdue' || dd < 0 ? 'red' : dd <= 7 ? 'amber' : 'blue'}>{dd < 0 ? `เลย ${-dd} วัน` : dd === 0 ? 'วันนี้' : `อีก ${dd} วัน`}</Badge></td>
                          <td><button className="btn btn-sm btn-soft" onClick={() => markDone(m)}>ทำแล้ว</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            people.length === 0 ? <Empty text="ไม่มีพนักงานในช่วงนี้" /> : (
              <div className="grid g3" style={{ gap: 12 }}>
                {people.slice(0, 60).map((e) => (
                  <div key={e.id} className="card card-pad clickable" style={{ padding: 14 }} onClick={() => setSel(e)}>
                    <Person emp={e} deptById={app.deptById} />
                    <div className="tiny faint mt8">{e.status === 'resigned' ? `วันสุดท้าย ${thDate(e.end_date)}` : `เริ่มงาน ${thDate(e.hire_date)}`}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      {sel && <EmployeeDrawer emp={sel} onClose={() => { setSel(null); reload() }} />}
    </div>
  )
}

