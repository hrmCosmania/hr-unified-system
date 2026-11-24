import { ArrowRight, Award, BookOpen, Briefcase, Calendar, Clock, Mail, Star, Target } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import CertificateModal from '../components/Certificate'
import { Avatar, Badge, Button, Card, cx, Field, LevelDots, Modal, Progress, Select, Table, Tabs } from '../components/ui'
import { competencyGap, employeeHours, idpProgress, promotionReadiness, recommendCourses } from '../lib/analytics'
import { CURRENT_YEAR, fmtDate, fullName, LABELS, yearsBetween } from '../lib/format'
import { useStore } from '../lib/store'
import { Ring } from './Career'

export default function EmployeeProfile() {
  const { id } = useParams()
  const { data, idx, visibleEmpIds, isHR } = useStore()
  const [tab, setTab] = useState('overview')
  const [cert, setCert] = useState(null)
  const [editTalent, setEditTalent] = useState(false)
  const e = idx.emp[id]
  if (!e) return <div className="text-slate-400">ไม่พบพนักงาน</div>
  if (!visibleEmpIds.has(e.id)) return <Navigate to="/" replace />

  const pos = idx.pos[e.position_id]
  const mgr = idx.emp[e.manager_id]
  const gaps = competencyGap(idx, e.id)
  const ens = (idx.enrollByEmp[e.id] || []).map((x) => ({ ...x, s: idx.session[x.session_id] })).filter((x) => x.s).sort((a, b) => b.s.start_date.localeCompare(a.s.start_date))
  const certs = idx.certByEmp[e.id] || []
  const idp = idx.idpByEmp[e.id]
  const path = data.career_paths.find((p) => p.from_position_id === e.position_id)
  const ready = path && promotionReadiness(data, idx, e.id, path)
  const perf = (idx.perfByEmp[e.id] || []).slice().sort((a, b) => b.year - a.year)
  const talent = idx.talentByEmp[e.id]
  const trackPositions = data.positions.filter((p) => p.career_track === pos.career_track).sort((a, b) => a.job_level - b.job_level)
  const recs = recommendCourses(data, idx, e.id, 4)

  return (
    <div>
      <div className="mb-2 text-xs text-slate-400"><Link to="/employees" className="hover:text-brand-600">พนักงาน</Link> › โปรไฟล์และเส้นทางการพัฒนา</div>
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar emp={e} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-navy-900">{fullName(e)}</h1>{e.nickname && <span className="text-slate-400">({e.nickname})</span>}{talent?.is_talent && <Badge tone="violet">Talent</Badge>}{e.status === 'probation' && <Badge tone="amber">ทดลองงาน</Badge>}</div>
            <div className="mt-1 grid gap-x-8 gap-y-1 text-sm text-slate-500 sm:grid-cols-2">
              <span>รหัสพนักงาน: {e.employee_code}</span><span>ตำแหน่ง: <b className="text-slate-700">{pos?.name}</b></span>
              <span>หน่วยงาน: {idx.dept[e.department_id]?.name}</span><span>สายธุรกิจ: {idx.bu[e.business_unit_id]?.name}</span>
              <span className="flex items-center gap-1"><Calendar size={14} />เริ่มงาน {fmtDate(e.hire_date)} ({yearsBetween(e.hire_date).toFixed(1)} ปี)</span>
              <span className="flex items-center gap-1"><Briefcase size={14} />หัวหน้า: {mgr ? <Link to={`/employees/${mgr.id}`} className="text-brand-600">{fullName(mgr)}</Link> : '-'}</span>
              <span className="flex items-center gap-1"><Mail size={14} />{e.email}</span>
              <span className="text-xs">HRM ID: {e.hrm_employee_id ?? '-'} · sync {e.synced_at ? fmtDate(e.synced_at) : '-'}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Mini icon={Clock} v={employeeHours(idx, e.id)} l="ชม.อบรมปีนี้" />
            <Mini icon={Award} v={certs.length} l="ใบประกาศ" />
            <Mini icon={Target} v={idp ? `${idpProgress(idx, idp.id)}%` : '-'} l="IDP" />
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'overview', label: 'ภาพรวม' }, { value: 'competency', label: 'สมรรถนะ' }, { value: 'training', label: 'ประวัติการอบรม', count: ens.length },
          { value: 'idp', label: 'แผนการพัฒนา' }, { value: 'career', label: 'เส้นทางสายอาชีพ' },
        ]} />

        {tab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <div className="mb-2 text-sm font-semibold">ผลการประเมินผลงาน (จาก Performance)</div>
              {perf.map((p) => <div key={p.year} className="flex justify-between border-b border-slate-50 py-1.5 text-sm"><span>ปี {p.year + 543}</span><span>{Number(p.score).toFixed(2)} <Badge tone={p.grade === 'A' ? 'green' : p.grade === 'B' ? 'blue' : p.grade === 'C' ? 'amber' : 'rose'}>{p.grade}</Badge></span></div>)}
              <div className="mb-2 mt-5 flex items-center justify-between text-sm font-semibold">Talent Review {CURRENT_YEAR + 543}{isHR && <button onClick={() => setEditTalent(true)} className="text-xs font-normal text-brand-600">แก้ไข</button>}</div>
              {talent ? <div className="text-sm text-slate-600">ผลงาน {['', 'ต่ำ', 'กลาง', 'สูง'][talent.performance]} · ศักยภาพ {['', 'ต่ำ', 'กลาง', 'สูง'][talent.potential]} · เสี่ยงลาออก <Badge status={talent.flight_risk}>{LABELS.risk[talent.flight_risk]}</Badge></div> : <div className="text-sm text-slate-400">ยังไม่ได้ประเมิน</div>}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Skill Gap หลัก</div>
              {gaps.filter((g) => g.gap > 0).slice(0, 5).map((g) => <div key={g.competency.id} className="mb-2 flex items-center justify-between text-sm"><span>{g.competency.name}</span><LevelDots value={g.current} required={g.required} /></div>)}
              {gaps.every((g) => g.gap === 0) && <div className="text-sm text-emerald-600">ผ่านเกณฑ์ทุกสมรรถนะ</div>}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">หลักสูตรแนะนำ</div>
              {recs.map(({ course }) => <Link key={course.id} to={`/courses/${course.id}`} className="mb-2 flex items-center gap-2 text-sm hover:text-brand-600"><BookOpen size={15} className="text-brand-500" />{course.title}</Link>)}
            </div>
          </div>
        )}

        {tab === 'competency' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="h-80"><ResponsiveContainer><RadarChart data={gaps.map((g) => ({ n: g.competency.name, ต้องการ: g.required, ปัจจุบัน: g.current }))} outerRadius="70%">
              <PolarGrid /><PolarAngleAxis dataKey="n" tick={{ fontSize: 10 }} /><PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
              <Radar dataKey="ต้องการ" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} /><Radar dataKey="ปัจจุบัน" stroke="#2f6fe4" fill="#2f6fe4" fillOpacity={0.3} /><Tooltip />
            </RadarChart></ResponsiveContainer></div>
            <Table rows={gaps} columns={[
              { key: 'c', label: 'สมรรถนะ', render: (g) => g.competency.name },
              { key: 'l', label: 'ระดับ', render: (g) => <LevelDots value={g.current} required={g.required} /> },
              { key: 'g', label: 'Gap', render: (g) => (g.gap ? <Badge tone={g.gap >= 2 ? 'rose' : 'amber'}>-{g.gap}</Badge> : <Badge tone="green">ผ่าน</Badge>) },
            ]} />
          </div>
        )}

        {tab === 'training' && (
          <Table rows={ens} empty="ยังไม่มีประวัติการอบรม" columns={[
            { key: 'c', label: 'หลักสูตร', render: (x) => <Link to={`/courses/${x.s.course_id}`} className="font-medium hover:text-brand-600">{idx.course[x.s.course_id]?.title}</Link> },
            { key: 'd', label: 'วันที่', render: (x) => fmtDate(x.s.start_date) },
            { key: 'h', label: 'ชม.', render: (x) => x.attended_hours ?? '-' },
            { key: 'sc', label: 'Pre/Post', render: (x) => (x.post_score != null ? `${x.pre_score} / ${x.post_score}` : '-') },
            { key: 'st', label: 'สถานะ', render: (x) => <Badge status={x.status}>{LABELS.enrollStatus[x.status]}</Badge> },
            { key: 'ct', label: '', render: (x) => { const c = certs.find((z) => z.enrollment_id === x.id); return c && <Button size="sm" variant="ghost" onClick={() => setCert(c)}><Award size={14} />ใบประกาศ</Button> } },
          ]} />
        )}

        {tab === 'idp' && (idp ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-4"><Badge status={idp.status}>{LABELS.idpStatus[idp.status]}</Badge><span className="text-sm">{idp.goal}</span><Link to={`/idp/${idp.id}`} className="ml-auto text-sm text-brand-600">เปิด IDP →</Link></div>
            <Table rows={idx.itemsByIdp[idp.id] || []} columns={[
              { key: 't', label: 'กิจกรรม', render: (i) => i.title },
              { key: 'm', label: 'วิธีการ', render: (i) => LABELS.method[i.method] },
              { key: 'd', label: 'กำหนด', render: (i) => fmtDate(i.target_date) },
              { key: 'p', label: 'ความคืบหน้า', render: (i) => <div className="flex w-32 items-center gap-2"><Progress value={i.progress} /><span className="text-xs">{i.progress}%</span></div> },
              { key: 's', label: 'สถานะ', render: (i) => <Badge status={i.status}>{LABELS.itemStatus[i.status]}</Badge> },
            ]} />
          </div>
        ) : <div className="py-8 text-center text-sm text-slate-400">ยังไม่มีแผนพัฒนารายบุคคล</div>)}

        {tab === 'career' && (
          <div>
            <div className="mb-6 flex items-center overflow-x-auto py-2">
              {trackPositions.map((p, i) => {
                const state = p.job_level < pos.job_level ? 'done' : p.id === pos.id ? 'current' : 'next'
                return (
                  <div key={p.id} className="flex items-center">
                    <div className="flex w-36 flex-col items-center text-center">
                      <div className={cx('grid h-9 w-9 place-items-center rounded-full ring-4', state === 'done' ? 'bg-emerald-500 ring-emerald-100' : state === 'current' ? 'bg-brand-600 ring-brand-100' : 'bg-white ring-slate-200')}>{state === 'current' && <Star size={16} className="fill-white text-white" />}</div>
                      <div className={cx('mt-2 text-xs', state === 'current' ? 'font-semibold text-brand-700' : 'text-slate-500')}>{p.name}</div>
                    </div>
                    {i < trackPositions.length - 1 && <div className={cx('h-1 w-10 rounded', state === 'done' ? 'bg-emerald-400' : 'bg-slate-200')} />}
                  </div>
                )
              })}
            </div>
            {ready ? (
              <div className="grid items-center gap-6 md:grid-cols-[180px_1fr]">
                <Ring value={ready.score} />
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm">{pos.name} <ArrowRight size={14} /> <b>{idx.pos[path.to_position_id]?.name}</b></div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>สมรรถนะ: <b>{Math.round(ready.compFit * 100)}%</b></div><div>หลักสูตรที่กำหนด: <b>{Math.round(ready.courseFit * 100)}%</b></div>
                    <div>อายุงาน: <b>{Math.round(ready.tenure * 100)}%</b></div><div>ผลงาน: <b>{Math.round(ready.perfFit * 100)}%</b></div>
                  </div>
                </div>
              </div>
            ) : <div className="text-sm text-slate-400">อยู่ในตำแหน่งสูงสุดของสายงาน</div>}
          </div>
        )}
      </Card>
      <CertificateModal cert={cert} onClose={() => setCert(null)} />
      {editTalent && <TalentEdit emp={e} review={talent} onClose={() => setEditTalent(false)} />}
    </div>
  )
}

function Mini({ icon: Icon, v, l }) {
  return <div className="rounded-xl bg-slate-50 px-4 py-3"><Icon size={18} className="mx-auto text-brand-600" /><div className="mt-1 text-lg font-bold text-navy-900">{v}</div><div className="text-[11px] text-slate-400">{l}</div></div>
}

function TalentEdit({ emp, review, onClose }) {
  const { insert, update, notify } = useStore()
  const [f, setF] = useState({ performance: review?.performance || 2, potential: review?.potential || 2, flight_risk: review?.flight_risk || 'low' })
  const save = async () => {
    const row = { performance: Number(f.performance), potential: Number(f.potential), flight_risk: f.flight_risk }
    const withFlag = { ...row, is_talent: row.performance + row.potential >= 5 }
    if (review) await update('talent_reviews', review.id, withFlag)
    else await insert('talent_reviews', { employee_id: emp.id, year: CURRENT_YEAR, ...withFlag })
    notify('บันทึก Talent Review แล้ว'); onClose()
  }
  const lv = [{ value: 1, label: 'ต่ำ' }, { value: 2, label: 'กลาง' }, { value: 3, label: 'สูง' }]
  return (
    <Modal open onClose={onClose} title={`Talent Review: ${fullName(emp)}`} footer={<Button onClick={save}>บันทึก</Button>}>
      <div className="space-y-3">
        <Field label="ผลงาน (Performance)"><Select value={f.performance} onChange={(e) => setF({ ...f, performance: e.target.value })} options={lv} /></Field>
        <Field label="ศักยภาพ (Potential)"><Select value={f.potential} onChange={(e) => setF({ ...f, potential: e.target.value })} options={lv} /></Field>
        <Field label="ความเสี่ยงลาออก"><Select value={f.flight_risk} onChange={(e) => setF({ ...f, flight_risk: e.target.value })} options={Object.entries(LABELS.risk).map(([value, label]) => ({ value, label }))} /></Field>
      </div>
    </Modal>
  )
}
