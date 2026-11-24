import { CalendarDays, CheckCircle2, Clock, FileText, MapPin, Pencil, PlayCircle, Plus, Star, User, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs } from '../components/ui'
import { fmtBaht, fmtRange, fullName, LABELS, TODAY } from '../lib/format'
import { useStore } from '../lib/store'
import { CourseForm } from './Courses'
import { CourseThumb } from './Dashboard'

export default function CourseDetail() {
  const { id } = useParams()
  const { data, idx, me, isHR, isManager, insert, notify, visibleEmpIds } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState('detail')
  const [edit, setEdit] = useState(false)
  const [addSession, setAddSession] = useState(false)
  const [nominate, setNominate] = useState(null)
  const c = idx.course[id]
  if (!c) return <div className="text-slate-400">ไม่พบหลักสูตร</div>

  const sessions = (idx.sessionsByCourse[c.id] || []).slice().sort((a, b) => a.start_date.localeCompare(b.start_date))
  const comps = data.course_competencies.filter((x) => x.course_id === c.id).map((x) => idx.comp[x.competency_id])
  const modules = (idx.modulesByCourse[c.id] || []).slice().sort((a, b) => a.seq - b.seq)
  const allEns = sessions.flatMap((s) => idx.enrollBySession[s.id] || [])
  const sat = allEns.filter((e) => e.satisfaction != null)
  const rating = sat.length ? sat.reduce((a, e) => a + Number(e.satisfaction), 0) / sat.length : null
  const myEnroll = me.employee && allEns.find((e) => e.employee_id === me.employee.id && !['rejected', 'no_show'].includes(e.status))

  const register = async (s) => {
    await insert('enrollments', { session_id: s.id, employee_id: me.employee.id, status: 'requested', source: 'self', created_at: new Date().toISOString() })
    notify('ส่งคำขอลงทะเบียนแล้ว — รอหัวหน้างานอนุมัติ')
  }

  const modIcon = { video: PlayCircle, pdf: FileText, quiz: CheckCircle2, workshop: Users, assignment: Pencil }

  return (
    <div>
      <PageHeader title={c.title} crumbs={[{ label: 'HRD', to: '/' }, { label: 'หลักสูตรอบรม', to: '/courses' }, { label: c.code }]}
        actions={isHR && <><Button variant="secondary" onClick={() => setEdit(true)}><Pencil size={15} />แก้ไข</Button><Button onClick={() => setAddSession(true)}><Plus size={16} />เปิดรุ่นอบรม</Button></>} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <div className="flex gap-5">
            <CourseThumb course={c} size={96} />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5"><Badge tone="blue">{c.category}</Badge><Badge tone="slate">{LABELS.format[c.format]}</Badge><Badge tone="violet">{LABELS.level[c.level]}</Badge>{c.is_mandatory && <Badge tone="rose">ภาคบังคับ</Badge>}</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{c.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Clock size={15} />{c.hours} ชั่วโมง</span>
                <span className="flex items-center gap-1"><Users size={15} />ผู้เรียนทั้งหมด {allEns.length} คน</span>
                {rating && <span className="flex items-center gap-1"><Star size={15} className="fill-amber-400 text-amber-400" />{rating.toFixed(1)} ({sat.length})</span>}
                <span>เกณฑ์ผ่าน {c.pass_score} คะแนน</span>
                {c.validity_months && <span>ใบรับรองอายุ {c.validity_months} เดือน</span>}
              </div>
              <div className="mt-2 text-sm text-slate-500">กลุ่มเป้าหมาย: {c.target_bu?.length ? c.target_bu.join(', ') : 'ทุกสายงาน'}</div>
            </div>
          </div>
        </Card>
        <Card title="สิ่งที่คุณจะได้รับ">
          <ul className="space-y-2">
            {(c.objectives || []).map((o) => <li key={o} className="flex gap-2 text-sm"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-600" />{o}</li>)}
          </ul>
          <div className="mt-4 text-sm font-medium text-slate-600">สมรรถนะที่พัฒนา</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{comps.map((x) => <Badge key={x.id} tone="teal">{x.name}</Badge>)}{!comps.length && <span className="text-sm text-slate-400">-</span>}</div>
          {myEnroll && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">คุณลงทะเบียนหลักสูตรนี้แล้ว — สถานะ: <b>{LABELS.enrollStatus[myEnroll.status]}</b></div>}
        </Card>
      </div>

      <Card className="mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'detail', label: 'รอบอบรม / ลงทะเบียน', count: sessions.length }, { value: 'modules', label: 'เนื้อหาหลักสูตร', count: modules.length }]} />
        {tab === 'detail' && (
          <div className="grid gap-3 md:grid-cols-2">
            {sessions.map((s) => {
              const ens = (idx.enrollBySession[s.id] || []).filter((e) => e.status !== 'rejected')
              const canReg = me.employee && !myEnroll && ['open', 'planned'].includes(s.status) && new Date(s.start_date) > TODAY && ens.length < s.capacity
              return (
                <div key={s.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between"><b className="text-navy-900">รุ่นที่ {s.batch_no}</b><Badge status={s.status}>{LABELS.sessionStatus[s.status]}</Badge></div>
                  <div className="mt-2 space-y-1 text-sm text-slate-500">
                    <div className="flex items-center gap-2"><CalendarDays size={15} />{fmtRange(s.start_date, s.end_date)} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)} น.</div>
                    <div className="flex items-center gap-2"><MapPin size={15} />{s.venue}</div>
                    <div className="flex items-center gap-2"><User size={15} />{idx.trainer[s.trainer_id]?.name || '-'}</div>
                    <div className="flex items-center gap-2"><Users size={15} />{ens.length}/{s.capacity} ที่นั่ง{isHR && ` · งบ ${fmtBaht(s.cost)}`}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canReg && <Button size="sm" onClick={() => register(s)}>ลงทะเบียน</Button>}
                    {isManager && ['open', 'planned'].includes(s.status) && <Button size="sm" variant="secondary" onClick={() => setNominate(s)}>ส่งลูกทีมเข้าอบรม</Button>}
                    {isManager && <Button size="sm" variant="ghost" onClick={() => nav(`/training/sessions/${s.id}`)}>ผู้เข้าอบรม / ผลประเมิน</Button>}
                  </div>
                </div>
              )
            })}
            {!sessions.length && <div className="py-8 text-center text-sm text-slate-400 md:col-span-2">ยังไม่มีรอบอบรม</div>}
          </div>
        )}
        {tab === 'modules' && (
          <div className="divide-y divide-slate-100">
            {modules.map((m) => {
              const I = modIcon[m.type] || FileText
              return (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><I size={18} /></div>
                  <div className="flex-1"><div className="text-sm font-medium">{m.title}</div><div className="text-xs text-slate-400">{m.type.toUpperCase()} · {m.minutes} นาที</div></div>
                </div>
              )
            })}
            {isHR && <AddModule course={c} next={modules.length + 1} />}
          </div>
        )}
      </Card>

      {edit && <CourseForm open course={c} onClose={() => setEdit(false)} />}
      {addSession && <SessionForm course={c} onClose={() => setAddSession(false)} />}
      {nominate && <NominateModal session={nominate} course={c} onClose={() => setNominate(null)} visibleEmpIds={visibleEmpIds} />}
    </div>
  )
}

function AddModule({ course, next }) {
  const { insert, notify } = useStore()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('video')
  const [minutes, setMinutes] = useState(30)
  const add = async () => {
    if (!title) return
    await insert('course_modules', { course_id: course.id, seq: next, title: `บทที่ ${next}: ${title}`, type, minutes: Number(minutes) })
    setTitle(''); notify('เพิ่มบทเรียนแล้ว')
  }
  return (
    <div className="flex flex-wrap items-end gap-2 pt-4">
      <div className="min-w-48 flex-1"><Field label="เพิ่มบทเรียน"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่อบทเรียน" /></Field></div>
      <div className="w-36"><Select value={type} onChange={(e) => setType(e.target.value)} options={['video', 'pdf', 'quiz', 'workshop', 'assignment'].map((v) => ({ value: v, label: v }))} /></div>
      <div className="w-24"><Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
      <Button onClick={add}><Plus size={16} />เพิ่ม</Button>
    </div>
  )
}

export function SessionForm({ course, onClose }) {
  const { data, idx, insert, notify } = useStore()
  const sessions = idx.sessionsByCourse[course.id] || []
  const [f, setF] = useState({ start_date: '', end_date: '', start_time: '09:00', end_time: '16:00', venue: '', trainer_id: data.trainers[0]?.id, capacity: 30, cost: 0, status: 'open' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    if (!f.start_date) return notify('กรุณาระบุวันที่เริ่ม', 'error')
    await insert('training_sessions', { ...f, course_id: course.id, end_date: f.end_date || f.start_date, capacity: Number(f.capacity), cost: Number(f.cost), batch_no: Math.max(0, ...sessions.map((s) => s.batch_no)) + 1 })
    notify('เปิดรุ่นอบรมแล้ว'); onClose()
  }
  return (
    <Modal open onClose={onClose} title={`เปิดรุ่นอบรม: ${course.title}`} footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึก</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วันที่เริ่ม"><Input type="date" value={f.start_date} onChange={set('start_date')} /></Field>
        <Field label="วันที่สิ้นสุด"><Input type="date" value={f.end_date} onChange={set('end_date')} /></Field>
        <Field label="เวลาเริ่ม"><Input type="time" value={f.start_time} onChange={set('start_time')} /></Field>
        <Field label="เวลาสิ้นสุด"><Input type="time" value={f.end_time} onChange={set('end_time')} /></Field>
        <div className="sm:col-span-2"><Field label="สถานที่"><Input value={f.venue} onChange={set('venue')} placeholder="ห้องอบรม / Online" /></Field></div>
        <Field label="วิทยากร"><Select value={f.trainer_id} onChange={set('trainer_id')} options={data.trainers.map((t) => ({ value: t.id, label: t.name }))} /></Field>
        <Field label="จำนวนที่นั่ง"><Input type="number" value={f.capacity} onChange={set('capacity')} /></Field>
        <Field label="งบประมาณ (บาท)"><Input type="number" value={f.cost} onChange={set('cost')} /></Field>
        <Field label="สถานะ"><Select value={f.status} onChange={set('status')} options={[{ value: 'planned', label: 'วางแผน' }, { value: 'open', label: 'เปิดรับสมัคร' }]} /></Field>
      </div>
    </Modal>
  )
}

function NominateModal({ session, course, onClose, visibleEmpIds }) {
  const { data, idx, insert, notify, me, isHR } = useStore()
  const [sel, setSel] = useState([])
  const [q, setQ] = useState('')
  const enrolled = new Set((idx.enrollBySession[session.id] || []).map((e) => e.employee_id))
  const candidates = data.employees.filter((e) => visibleEmpIds.has(e.id) && e.id !== me.employee?.id && !enrolled.has(e.id) && e.status !== 'resigned'
    && (!q || `${fullName(e)} ${e.employee_code}`.includes(q))).slice(0, 80)
  const save = async () => {
    await insert('enrollments', sel.map((eid) => ({ session_id: session.id, employee_id: eid, status: 'approved', source: isHR ? 'hr' : 'manager', approved_by: me.employee?.id, approved_at: new Date().toISOString(), created_at: new Date().toISOString() })))
    notify(`ส่งพนักงาน ${sel.length} คนเข้าอบรมแล้ว`); onClose()
  }
  return (
    <Modal open onClose={onClose} title={`ส่งพนักงานเข้าอบรม: ${course.title} รุ่นที่ ${session.batch_no}`} wide
      footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button disabled={!sel.length} onClick={save}>ยืนยัน ({sel.length})</Button></>}>
      <Input placeholder="ค้นหาชื่อหรือรหัสพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        {candidates.map((e) => (
          <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={sel.includes(e.id)} onChange={(ev) => setSel(ev.target.checked ? [...sel, e.id] : sel.filter((x) => x !== e.id))} />
            <span className="flex-1 truncate">{fullName(e)} <span className="text-xs text-slate-400">· {idx.pos[e.position_id]?.name}</span></span>
          </label>
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-400">ลูกทีมที่ถูกส่งโดยหัวหน้า/HR จะได้รับการอนุมัติทันที · <Link to="/employees" className="text-brand-600">ดูรายชื่อพนักงาน</Link></div>
    </Modal>
  )
}
