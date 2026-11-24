import { Banknote, Clock, Download, GraduationCap, ShieldCheck, Star, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Card, PageHeader, Progress, Select, Stat, Table } from '../components/ui'
import { completedCourseIds } from '../lib/analytics'
import { CATEGORY_COLORS, CURRENT_YEAR, downloadCSV, fmtBaht, fmtNum, fullName, pct, TODAY, yearsBetween } from '../lib/format'
import { useStore } from '../lib/store'

export default function Reports() {
  const { data, idx } = useStore()
  const [year, setYear] = useState(CURRENT_YEAR)

  const r = useMemo(() => {
    const sessions = data.training_sessions.filter((s) => new Date(s.start_date).getFullYear() === year)
    const sesSet = new Set(sessions.map((s) => s.id))
    const ens = data.enrollments.filter((e) => sesSet.has(e.session_id))
    const done = ens.filter((e) => ['completed', 'failed', 'attended'].includes(e.status))
    const active = data.employees.filter((e) => e.status !== 'resigned')
    const trained = new Set(done.map((e) => e.employee_id))
    const hours = done.reduce((a, e) => a + Number(e.attended_hours || 0), 0)
    const spent = sessions.filter((s) => s.status !== 'cancelled' && new Date(s.start_date) <= TODAY).reduce((a, s) => a + Number(s.cost || 0), 0)
    const budget = data.training_budgets.filter((b) => b.year === year).reduce((a, b) => a + Number(b.budget), 0)
    const avg = (arr, f) => (arr.length ? arr.reduce((a, x) => a + Number(f(x)), 0) / arr.length : null)
    const sat = done.filter((e) => e.satisfaction != null)
    const scored = done.filter((e) => e.post_score != null)
    const beh = done.filter((e) => e.behavior_score != null)

    const byBU = data.business_units.map((b) => {
      const emps = active.filter((e) => e.business_unit_id === b.id)
      const set = new Set(emps.map((e) => e.id))
      const d = done.filter((e) => set.has(e.employee_id))
      const sp = sessions.filter((s) => new Date(s.start_date) <= TODAY && s.status !== 'cancelled').reduce((a, s) => {
        const en = (idx.enrollBySession[s.id] || []).filter((e) => !['rejected'].includes(e.status))
        return a + (en.length ? (Number(s.cost) * en.filter((e) => set.has(e.employee_id)).length) / en.length : 0)
      }, 0)
      const bud = data.training_budgets.find((x) => x.business_unit_id === b.id && x.year === year)?.budget || 0
      return { name: b.name.replace(/ \(.*\)/, ''), 'ชม./คน': +(d.reduce((a, e) => a + Number(e.attended_hours || 0), 0) / Math.max(1, emps.length)).toFixed(1), 'อบรมแล้ว (%)': pct(new Set(d.map((e) => e.employee_id)).size, emps.length), งบประมาณ: bud, ใช้จริง: Math.round(sp) }
    })

    const cats = {}
    done.forEach((e) => { const c = idx.course[idx.session[e.session_id].course_id]; cats[c.category] = (cats[c.category] || 0) + 1 })
    const catData = Object.entries(cats).map(([name, value]) => ({ name, value }))

    const courseRows = data.courses.map((c) => {
      const ss = sessions.filter((s) => s.course_id === c.id)
      const e = ss.flatMap((s) => idx.enrollBySession[s.id] || []).filter((x) => ['completed', 'failed', 'attended'].includes(x.status))
      const sc = e.filter((x) => x.post_score != null)
      const cost = ss.filter((s) => new Date(s.start_date) <= TODAY).reduce((a, s) => a + Number(s.cost), 0)
      return {
        id: c.id, หลักสูตร: c.title, หมวด: c.category, รุ่น: ss.length, ผู้เรียน: e.length,
        'ผ่าน (%)': sc.length ? pct(sc.filter((x) => x.status === 'completed').length, sc.length) : '-',
        'L1 พึงพอใจ': avg(e.filter((x) => x.satisfaction != null), (x) => x.satisfaction)?.toFixed(2) ?? '-',
        'L2 คะแนนเพิ่ม': sc.length ? `+${avg(sc, (x) => x.post_score - x.pre_score).toFixed(1)}` : '-',
        'L3 พฤติกรรม': avg(e.filter((x) => x.behavior_score != null), (x) => x.behavior_score)?.toFixed(2) ?? '-',
        ค่าใช้จ่าย: cost, 'ต้นทุน/คน': e.length ? Math.round(cost / e.length) : '-',
      }
    }).filter((x) => x.รุ่น > 0).sort((a, b) => b.ผู้เรียน - a.ผู้เรียน)

    // Mandatory compliance
    const mandatory = data.courses.filter((c) => c.is_mandatory)
    const compliance = mandatory.map((c) => {
      const target = active.filter((e) => (!c.target_bu?.length || c.target_bu.includes(idx.bu[e.business_unit_id]?.code)) && (!c.code.startsWith('ORI') || yearsBetween(e.hire_date) < 1))
      const passed = target.filter((e) => {
        const cert = (idx.certByEmp[e.id] || []).find((x) => x.course_id === c.id && (!x.expires_at || new Date(x.expires_at) >= TODAY))
        return cert || (!c.validity_months && completedCourseIds(idx, e.id).has(c.id))
      }).length
      return { c, target: target.length, passed }
    })

    return { sessions, ens, done, active, trained, hours, spent, budget, sat, scored, beh, byBU, catData, courseRows, compliance, avg }
  }, [data, idx, year])

  const exportHistory = () => downloadCSV(`training_history_${year}.csv`, r.done.map((e) => {
    const s = idx.session[e.session_id]; const emp = idx.emp[e.employee_id]
    return { รหัสพนักงาน: emp.employee_code, ชื่อ: fullName(emp), หน่วยงาน: idx.dept[emp.department_id]?.name, หลักสูตร: idx.course[s.course_id].title, วันที่: s.start_date, ชั่วโมง: e.attended_hours, pre: e.pre_score, post: e.post_score, ผล: e.status, พึงพอใจ: e.satisfaction }
  }))

  return (
    <div>
      <PageHeader title="รายงานและวิเคราะห์ข้อมูล" subtitle="Training Effectiveness (Kirkpatrick 4 Levels), งบประมาณ, Compliance และ ROI การพัฒนา" crumbs={[{ label: 'HRD', to: '/' }, { label: 'รายงาน' }]}
        actions={<><div className="w-32"><Select value={year} onChange={(e) => setYear(Number(e.target.value))} options={[2026, 2027].map((y) => ({ value: y, label: `ปี ${y + 543}` }))} /></div><Button variant="secondary" onClick={exportHistory}><Download size={16} />Export ประวัติอบรม</Button></>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Stat icon={GraduationCap} label="อัตราการอบรม" value={`${pct(r.trained.size, r.active.length)}%`} sub={`${fmtNum(r.trained.size)} / ${fmtNum(r.active.length)} คน`} tone="blue" />
        <Stat icon={Clock} label="ชั่วโมงเฉลี่ย/คน" value={fmtNum(r.hours / Math.max(1, r.active.length), 1)} unit="ชม." sub={`รวม ${fmtNum(r.hours)} ชม.`} tone="green" />
        <Stat icon={Star} label="L1 ความพึงพอใจ" value={r.avg(r.sat, (e) => e.satisfaction)?.toFixed(2) ?? '-'} unit="/5" tone="amber" />
        <Stat icon={TrendingUp} label="L2 คะแนนเพิ่มเฉลี่ย" value={`+${fmtNum(r.avg(r.scored, (e) => e.post_score - e.pre_score), 1)}`} sub={`ผ่าน ${pct(r.scored.filter((e) => e.status === 'completed').length, r.scored.length)}%`} tone="violet" />
        <Stat icon={ShieldCheck} label="L3 การนำไปใช้" value={r.avg(r.beh, (e) => e.behavior_score)?.toFixed(2) ?? '-'} unit="/5" sub={`ประเมินแล้ว ${pct(r.beh.length, r.done.length)}%`} tone="teal" />
        <Stat icon={Banknote} label="ใช้งบประมาณ" value={`${pct(r.spent, r.budget)}%`} sub={`${fmtBaht(r.spent)} / ${fmtBaht(r.budget)}`} tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="การพัฒนาแยกตามสายธุรกิจ" className="xl:col-span-2">
          <div className="h-72"><ResponsiveContainer>
            <BarChart data={r.byBU}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="อบรมแล้ว (%)" fill="#2f6fe4" radius={[6, 6, 0, 0]} /><Bar dataKey="ชม./คน" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </Card>
        <Card title="สัดส่วนการอบรมตามหมวดหมู่">
          <div className="h-72"><ResponsiveContainer>
            <PieChart><Pie data={r.catData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>{r.catData.map((c) => <Cell key={c.name} fill={CATEGORY_COLORS[c.name]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
          </ResponsiveContainer></div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="งบประมาณ vs ใช้จริง (บาท)">
          <div className="h-64"><ResponsiveContainer>
            <BarChart data={r.byBU}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1e6}M`} /><Tooltip formatter={(v) => fmtBaht(v)} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="งบประมาณ" fill="#cbd5e1" radius={[6, 6, 0, 0]} /><Bar dataKey="ใช้จริง" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </Card>
        <Card title="Compliance หลักสูตรภาคบังคับ (ใบรับรองยังไม่หมดอายุ)">
          <div className="space-y-4">
            {r.compliance.map(({ c, target, passed }) => {
              const p = pct(passed, target)
              return <div key={c.id}><div className="mb-1 flex justify-between text-sm"><span>{c.title}</span><span><b>{p}%</b> <span className="text-xs text-slate-400">({fmtNum(passed)}/{fmtNum(target)})</span></span></div><Progress value={p} tone={p >= 90 ? 'green' : p >= 70 ? 'amber' : 'rose'} /></div>
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="ประสิทธิผลรายหลักสูตร (Kirkpatrick & ROI)" action={<Button size="sm" variant="secondary" onClick={() => downloadCSV(`course_effectiveness_${year}.csv`, r.courseRows.map(({ id, ...x }) => x))}><Download size={14} />Export</Button>}>
        <Table rows={r.courseRows} columns={['หลักสูตร', 'หมวด', 'รุ่น', 'ผู้เรียน', 'ผ่าน (%)', 'L1 พึงพอใจ', 'L2 คะแนนเพิ่ม', 'L3 พฤติกรรม', 'ค่าใช้จ่าย', 'ต้นทุน/คน'].map((k) => ({
          key: k, label: k, className: k === 'หลักสูตร' ? 'min-w-56' : 'whitespace-nowrap', render: (x) => (['ค่าใช้จ่าย', 'ต้นทุน/คน'].includes(k) && typeof x[k] === 'number' ? fmtBaht(x[k]) : x[k]),
        }))} />
      </Card>
    </div>
  )
}
