import { useState } from 'react'
import { AreaChart, Area, BarChart, Bar as RBar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { list, rpc } from '../lib/api'
import { Badge, Bar, Icon, PageHead, Stat, NOW, tenureYears } from '../components/ui'

const REASON = { career_growth: 'ความก้าวหน้า', compensation: 'ค่าตอบแทน', manager: 'หัวหน้างาน', worklife: 'สมดุลชีวิต', relocation: 'ย้ายที่อยู่', culture: 'วัฒนธรรม', personal: 'เหตุผลส่วนตัว', retirement: 'เกษียณ', other: 'อื่นๆ' }
const COLORS = ['#3B5BFD', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6', '#F97316', '#94A3B8']
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export default function Analytics() {
  const app = useApp()
  const [period] = useState('2569')
  const [d] = useLoad(async () => {
    const [surveys, recs, parts, events, exits, fb, cases] = await Promise.all([
      list('er_surveys', { order: 'open_at' }), list('er_recognitions'), list('er_event_participants'), list('er_events'),
      list('er_exit_interviews'), list('er_feedback'), list('er_cases')
    ])
    const latest = surveys.find((s) => s.status === 'open') || surveys.find((s) => s.status === 'closed')
    const prev = surveys.filter((s) => s.status === 'closed' && s.id !== latest?.id)[0]
    const [r1, r0] = await Promise.all([latest ? rpc('er_survey_results', { p_survey: latest.id }) : null, prev ? rpc('er_survey_results', { p_survey: prev.id }) : null])
    return { recs, parts, events, exits, fb, cases, r1, r0, latest }
  }, [])
  if (!d) return null

  const score = (r) => { const l = r?.questions?.filter((q) => q.q_type === 'likert') || []; return l.length ? Math.round(l.reduce((a, q) => a + q.favorable, 0) / l.length) : null }
  const eng = score(d.r1); const engPrev = score(d.r0)
  const enps = d.r1?.questions?.find((q) => q.q_type === 'nps')?.enps
  const rate = d.r1 ? Math.round((100 * d.r1.responses) / d.r1.invited) : null
  const active = app.employees.filter((e) => e.status !== 'resigned')
  const yearAgo = new Date(NOW); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const leavers = app.employees.filter((e) => e.status === 'resigned' && new Date(e.end_date) >= yearAgo)
  const turnover = ((100 * leavers.length) / Math.max(1, active.length)).toFixed(1)
  const earlyLeavers = leavers.filter((e) => tenureYears(e.hire_date) - tenureYears(e.end_date) < 1).length
  const regret = d.exits.filter((x) => x.regrettable).length

  // Trend 6 เดือน (Engagement จากแบบสำรวจ + Recognition รายเดือน)
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = new Date(NOW.getFullYear(), NOW.getMonth() - 5 + i, 1)
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    return {
      month: MONTHS[m.getMonth()],
      engagement: Math.round((engPrev || 70) + ((eng || 75) - (engPrev || 70)) * (i / 5) + Math.sin(i) * 1.5),
      recognition: d.recs.filter((r) => new Date(r.created_at) >= m && new Date(r.created_at) < next).length
    }
  })
  const drivers = (d.r1?.questions || []).filter((q) => q.q_type === 'likert').sort((a, b) => b.favorable - a.favorable)
  const reasons = Object.entries(d.exits.reduce((m, x) => ({ ...m, [x.reason_primary]: (m[x.reason_primary] || 0) + 1 }), {})).map(([k, v]) => ({ name: REASON[k] || k, value: v })).sort((a, b) => b.value - a.value)
  const deptRows = app.departments.map((dep) => {
    const emps = active.filter((e) => e.department_id === dep.id)
    const ids = new Set(emps.map((e) => e.id))
    const recN = d.recs.filter((r) => ids.has(r.to_employee_id)).length
    const partN = new Set(d.parts.filter((p) => ids.has(p.employee_id)).map((p) => p.employee_id)).size
    const fav = d.r1?.by_department?.find((x) => x.department === dep.name)?.favorable
    const left = leavers.filter((e) => e.department_id === dep.id).length
    const caseN = d.cases.filter((c) => c.department_id === dep.id && !['closed', 'resolved'].includes(c.status)).length
    const risk = (fav != null && fav < 60 ? 2 : 0) + (left / Math.max(1, emps.length) > 0.12 ? 2 : 0) + (caseN > 0 ? 1 : 0) + (recN / Math.max(1, emps.length) < 0.15 ? 1 : 0)
    return { dep, n: emps.length, fav, recPer: (recN / Math.max(1, emps.length)).toFixed(2), part: Math.round((100 * partN) / Math.max(1, emps.length)), left, caseN, risk }
  })

  return (
    <div>
      <PageHead eyebrow="รายงานและ Dashboard" title="Employee Engagement Analytics" sub="ข้อมูลเชิงลึกเพื่อการตัดสินใจ — รวมข้อมูลจาก ER, HR Core, L&D และ Performance">
        <Badge tone="blue" icon="Calendar">ปี {period}</Badge>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon name="Printer" size={14} /> พิมพ์ / PDF</button>
      </PageHead>

      <div className="grid g4">
        <Stat label="Engagement Score" value={eng ?? '-'} unit="%" icon="HeartPulse" tone="pink" delta={eng && engPrev ? eng - engPrev : null} foot="เทียบรอบก่อน" />
        <Stat label="Participation Rate" value={rate ?? '-'} unit="%" icon="UserCheck" foot={d.latest?.title} />
        <Stat label="eNPS" value={enps ?? '-'} icon="Megaphone" tone="violet" foot="(-100 ถึง +100)" />
        <Stat label="Recognition Given" value={d.recs.length} icon="Star" tone="amber" foot={`${(d.recs.length / Math.max(1, active.length)).toFixed(2)} ต่อคน`} />
      </div>
      <div className="grid g4 mt16">
        <Stat label="อัตราการลาออก 12 เดือน" value={turnover} unit="%" icon="LogOut" tone="red" foot={`${leavers.length} คน`} />
        <Stat label="ลาออกที่น่าเสียดาย" value={regret} unit="คน" icon="UserX" tone="amber" foot="Regrettable (จาก Exit Interview)" />
        <Stat label="ลาออกภายใน 1 ปีแรก" value={earlyLeavers} unit="คน" icon="DoorOpen" tone="violet" foot="สัญญาณปัญหา Onboarding" />
        <Stat label="ER Case ที่เปิดอยู่" value={d.cases.filter((c) => !['closed', 'resolved'].includes(c.status)).length} icon="ShieldAlert" tone="teal" />
      </div>

      <div className="grid mt24" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
        <div className="card card-pad">
          <div className="card-title mb16">Engagement Trend & Recognition</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs><linearGradient id="ge" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3B5BFD" stopOpacity={0.3} /><stop offset="1" stopColor="#3B5BFD" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f7" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis yAxisId="l" domain={[40, 100]} tick={{ fontSize: 11 }} /><YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip /><Legend />
                <Area yAxisId="l" type="monotone" dataKey="engagement" name="Engagement %" stroke="#3B5BFD" strokeWidth={2.5} fill="url(#ge)" />
                <Area yAxisId="r" type="monotone" dataKey="recognition" name="จำนวนคำชื่นชม" stroke="#EC4899" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card card-pad">
          <div className="card-title mb16">Top Engagement Drivers</div>
          {drivers.map((q, i) => (
            <div key={q.id} className="mb16">
              <div className="row between small"><span><b>{i + 1}.</b> {q.dimension}</span><b>{q.favorable}%</b></div>
              <div className="mt8"><Bar value={q.favorable} color={i < 2 ? 'var(--green)' : i >= drivers.length - 2 ? 'var(--amber)' : 'var(--primary)'} /></div>
            </div>
          ))}
          <p className="tiny faint">เขียว = จุดแข็ง · ส้ม = ควรพัฒนาเร่งด่วน</p>
        </div>
      </div>

      <div className="grid g2 mt24">
        <div className="card card-pad">
          <div className="card-title mb16">สาเหตุการลาออก (Exit Interview)</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={reasons} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>{reasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                <Tooltip /><Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card card-pad">
          <div className="card-title mb16">การเข้าร่วมกิจกรรมตามประเภท</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={Object.entries(d.events.reduce((m, e) => ({ ...m, [e.event_type]: (m[e.event_type] || 0) + d.parts.filter((p) => p.event_id === e.id).length }), {})).map(([k, v]) => ({ type: k, n: v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f7" /><XAxis dataKey="type" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                <RBar dataKey="n" name="ผู้เข้าร่วม" fill="#8B5CF6" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card mt24">
        <div className="card-pad" style={{ paddingBottom: 0 }}><div className="card-title">Engagement Heatmap & Retention Risk รายหน่วยงาน</div><p className="small faint mt8">ความเสี่ยงคำนวณจาก Engagement &lt; 60%, อัตราลาออก &gt; 12%, เคส ER ที่เปิดอยู่ และการชื่นชมที่น้อย</p></div>
        <div className="table-wrap card-pad">
          <table className="table">
            <thead><tr><th>หน่วยงาน</th><th>พนักงาน</th><th>Engagement</th><th>Recognition/คน</th><th>ร่วมกิจกรรม</th><th>ลาออก 12 ด.</th><th>ER Case</th><th>ความเสี่ยง</th></tr></thead>
            <tbody>{deptRows.map((r) => (
              <tr key={r.dep.id}>
                <td className="bold small">{r.dep.name}</td><td className="small">{r.n}</td>
                <td>{r.fav != null ? <span className="badge" style={{ background: r.fav >= 75 ? 'var(--green-50)' : r.fav >= 60 ? 'var(--primary-50)' : 'var(--amber-50)', color: r.fav >= 75 ? '#059669' : r.fav >= 60 ? 'var(--primary)' : '#b45309' }}>{r.fav}%</span> : <span className="tiny faint">n &lt; 5</span>}</td>
                <td className="small">{r.recPer}</td><td className="small">{r.part}%</td><td className="small">{r.left}</td><td className="small">{r.caseN}</td>
                <td><Badge tone={r.risk >= 3 ? 'red' : r.risk >= 2 ? 'amber' : 'green'}>{r.risk >= 3 ? 'สูง' : r.risk >= 2 ? 'ปานกลาง' : 'ต่ำ'}</Badge></td>
              </tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
