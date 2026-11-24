import { Plus, Sparkles, Target, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Stat, Table } from '../components/ui'
import { competencyGap, idpProgress, recommendCourses } from '../lib/analytics'
import { CURRENT_YEAR, fmtDate, fullName, LABELS } from '../lib/format'
import { useStore } from '../lib/store'

export default function IDP() {
  const { id } = useParams()
  const { me, isManager, idx } = useStore()
  if (id) return <IDPDetail idpId={id} />
  if (!isManager) {
    const mine = idx.idpByEmp[me.employee?.id]
    return mine ? <IDPDetail idpId={mine.id} /> : <CreateIDP empId={me.employee?.id} />
  }
  return <IDPList />
}

function IDPList() {
  const { data, idx, visibleEmpIds } = useStore()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [status, setStatus] = useState(sp.get('status') || '')
  const [q, setQ] = useState('')
  const rows = useMemo(() => data.idps.filter((i) => visibleEmpIds.has(i.employee_id)).map((i) => {
    const items = idx.itemsByIdp[i.id] || []
    return { ...i, emp: idx.emp[i.employee_id], progress: idpProgress(idx, i.id), items: items.length, overdue: items.filter((x) => x.status === 'overdue').length }
  }), [data, idx, visibleEmpIds])
  const list = rows.filter((r) => (!status || (status === 'overdue' ? r.overdue > 0 : r.status === status)) && (!q || `${fullName(r.emp)} ${r.emp.employee_code}`.includes(q)))
  const withIdp = new Set(rows.map((r) => r.employee_id))
  const eligible = data.employees.filter((e) => visibleEmpIds.has(e.id) && e.status !== 'resigned').length
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.progress, 0) / rows.length) : 0

  return (
    <div>
      <PageHeader title="แผนพัฒนารายบุคคล (IDP)" subtitle="Individual Development Plan ตามหลัก 70 : 20 : 10 เชื่อมโยง Skill Gap และ Career Path" crumbs={[{ label: 'HRD', to: '/' }, { label: 'แผนพัฒนาบุคลากร' }]} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Target} label="พนักงานที่มี IDP" value={withIdp.size} unit="คน" sub={`${Math.round((withIdp.size / Math.max(1, eligible)) * 100)}% ของพนักงาน`} tone="blue" />
        <Stat icon={Target} label="ความคืบหน้าเฉลี่ย" value={`${avg}%`} tone="green" />
        <Stat icon={Target} label="รออนุมัติ" value={rows.filter((r) => r.status === 'submitted').length} unit="แผน" tone="amber" />
        <Stat icon={Target} label="แผนที่มีกิจกรรมเลยกำหนด" value={rows.filter((r) => r.overdue).length} unit="แผน" tone="rose" />
      </div>
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="w-64"><Input placeholder="ค้นหาพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="w-52"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(LABELS.idpStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="overdue">มีกิจกรรมเลยกำหนด</option></Select></div>
        </div>
        <Table rows={list} max={100} onRowClick={(r) => nav(`/idp/${r.id}`)} columns={[
          { key: 'e', label: 'พนักงาน', render: (r) => <div className="flex items-center gap-2"><Avatar emp={r.emp} size={32} /><div><div className="font-medium">{fullName(r.emp)}</div><div className="text-xs text-slate-400">{idx.pos[r.emp.position_id]?.name}</div></div></div> },
          { key: 'g', label: 'เป้าหมาย', className: 'hidden lg:table-cell', render: (r) => <span className="text-slate-500">{r.goal}</span> },
          { key: 'i', label: 'กิจกรรม', render: (r) => <span>{r.items}{r.overdue > 0 && <span className="ml-1 text-xs text-rose-500">({r.overdue} เลยกำหนด)</span>}</span> },
          { key: 'p', label: 'ความคืบหน้า', render: (r) => <div className="flex w-32 items-center gap-2"><Progress value={r.progress} tone={r.progress === 100 ? 'green' : 'blue'} /><span className="text-xs">{r.progress}%</span></div> },
          { key: 's', label: 'สถานะ', render: (r) => <Badge status={r.status}>{LABELS.idpStatus[r.status]}</Badge> },
        ]} />
      </Card>
    </div>
  )
}

function CreateIDP({ empId }) {
  const { insert, data, notify } = useStore()
  const nav = useNavigate()
  if (!empId) return <Empty title="ยังไม่ได้ผูกบัญชีกับข้อมูลพนักงาน" />
  const create = async () => {
    const emp = data.employees.find((e) => e.id === empId)
    const next = data.career_paths.find((p) => p.from_position_id === emp.position_id)
    const [idp] = await insert('idps', { employee_id: empId, year: CURRENT_YEAR, status: 'draft', goal: 'พัฒนาความสามารถตามเป้าหมายอาชีพ', target_position_id: next?.to_position_id || null })
    notify('สร้างแผนพัฒนาแล้ว'); nav(`/idp/${idp.id}`)
  }
  return (
    <Card><Empty icon={Target} title="คุณยังไม่มีแผนพัฒนารายบุคคลปีนี้">
      <div className="mb-4">เริ่มวางแผนร่วมกับหัวหน้างาน ระบบจะแนะนำกิจกรรมจาก Skill Gap ของคุณ</div>
      <Button onClick={create}><Plus size={16} />สร้าง IDP {CURRENT_YEAR + 543}</Button>
    </Empty></Card>
  )
}

const MIX_COLORS = { '70': '#2f6fe4', '20': '#10b981', '10': '#f59e0b' }
const mixOf = (m) => (['ojt', 'project'].includes(m) ? '70' : m === 'coaching' ? '20' : '10')

export function IDPDetail({ idpId }) {
  const { data, idx, me, isManager, isHR, update, insert, remove, notify } = useStore()
  const [adding, setAdding] = useState(false)
  const idp = idx.idp[idpId]
  if (!idp) return <div className="text-slate-400">ไม่พบแผนพัฒนา</div>
  const emp = idx.emp[idp.employee_id]
  const isOwner = me.employee?.id === emp.id
  const isApprover = isHR || (isManager && emp.manager_id === me.employee?.id)
  const canEdit = isOwner || isApprover
  const items = (idx.itemsByIdp[idp.id] || []).slice().sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''))
  const progress = idpProgress(idx, idp.id)
  const gaps = competencyGap(idx, emp.id, idp.target_position_id || emp.position_id).filter((g) => g.gap > 0)
  const recs = recommendCourses(data, idx, emp.id, 3)
  const mix = ['70', '20', '10'].map((k) => ({ name: { 70: 'เรียนรู้จากงาน 70%', 20: 'เรียนรู้จากผู้อื่น 20%', 10: 'อบรม/เรียน 10%' }[k], key: k, value: items.filter((i) => mixOf(i.method) === k).length }))

  const setStatus = async (status) => { await update('idps', idp.id, { status, ...(status === 'approved' ? { approved_by: me.employee?.id } : {}) }); notify(`สถานะ: ${LABELS.idpStatus[status]}`) }
  const setProgress = async (it, p) => {
    p = Number(p)
    await update('idp_items', it.id, { progress: p, status: p === 100 ? 'completed' : p > 0 ? 'in_progress' : 'not_started' })
    if (idp.status === 'approved' && p > 0) await update('idps', idp.id, { status: 'in_progress' })
  }
  const enrollFromItem = async (it) => {
    const s = (idx.sessionsByCourse[it.course_id] || []).filter((x) => ['open', 'planned'].includes(x.status)).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
    if (!s) return notify('ยังไม่มีรุ่นอบรมที่เปิดรับ', 'error')
    if ((idx.enrollByEmp[emp.id] || []).some((e) => e.session_id === s.id)) return notify('ลงทะเบียนรุ่นนี้แล้ว', 'error')
    await insert('enrollments', { session_id: s.id, employee_id: emp.id, status: isApprover ? 'approved' : 'requested', source: 'idp', created_at: new Date().toISOString() })
    notify(`ลงทะเบียน ${idx.course[it.course_id].title} รุ่นที่ ${s.batch_no} แล้ว`)
  }

  return (
    <div>
      <PageHeader title={`แผนพัฒนารายบุคคล ${idp.year + 543}`} crumbs={[{ label: 'แผนพัฒนาบุคลากร', to: '/idp' }, { label: fullName(emp) }]}
        actions={<>
          {isOwner && idp.status === 'draft' && <Button onClick={() => setStatus('submitted')}>ส่งให้หัวหน้าอนุมัติ</Button>}
          {isApprover && idp.status === 'submitted' && <><Button variant="secondary" onClick={() => setStatus('draft')}>ส่งกลับแก้ไข</Button><Button variant="success" onClick={() => setStatus('approved')}>อนุมัติแผน</Button></>}
          {isApprover && ['approved', 'in_progress'].includes(idp.status) && progress === 100 && <Button variant="success" onClick={() => setStatus('completed')}>ปิดแผน (เสร็จสิ้น)</Button>}
        </>} />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar emp={emp} size={56} />
            <div className="min-w-0 flex-1">
              <Link to={`/employees/${emp.id}`} className="text-lg font-semibold hover:text-brand-600">{fullName(emp)}</Link>
              <div className="text-sm text-slate-500">{emp.employee_code} · {idx.pos[emp.position_id]?.name} · {idx.dept[emp.department_id]?.name}</div>
              <div className="mt-2 text-sm"><b>เป้าหมาย:</b> {idp.goal}</div>
              {idp.target_position_id && <div className="text-sm"><b>ตำแหน่งเป้าหมาย:</b> {idx.pos[idp.target_position_id]?.name}</div>}
              <div className="mt-1 text-sm text-slate-500">ผู้อนุมัติ: {fullName(idx.emp[idp.approved_by] || idx.emp[emp.manager_id])}</div>
            </div>
            <div className="text-right"><Badge status={idp.status}>{LABELS.idpStatus[idp.status]}</Badge><div className="mt-2 text-3xl font-bold text-navy-900">{progress}%</div><div className="text-xs text-slate-400">ความคืบหน้า</div></div>
          </div>
          <Progress value={progress} tone="green" className="mt-4" />
        </Card>
        <Card title="สัดส่วน 70 : 20 : 10">
          <div className="flex items-center gap-3">
            <div className="h-32 w-32"><ResponsiveContainer><PieChart><Pie data={mix} dataKey="value" innerRadius={35} outerRadius={58} paddingAngle={2}>{mix.map((m) => <Cell key={m.key} fill={MIX_COLORS[m.key]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="space-y-1.5 text-sm">{mix.map((m) => <div key={m.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: MIX_COLORS[m.key] }} />{m.name}: <b>{m.value}</b></div>)}</div>
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="กิจกรรมพัฒนา" action={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus size={14} />เพิ่มกิจกรรม</Button>}>
        <Table rows={items} empty="ยังไม่มีกิจกรรม — เพิ่มจาก Skill Gap ด้านล่าง" columns={[
          { key: 't', label: 'กิจกรรม', render: (it) => <div><div className="font-medium">{it.title}</div><div className="text-xs text-slate-400">{idx.comp[it.competency_id]?.name || '-'}</div></div> },
          { key: 'm', label: 'วิธีการ', render: (it) => <Badge tone={{ 70: 'blue', 20: 'green', 10: 'amber' }[mixOf(it.method)]}>{LABELS.method[it.method]}</Badge> },
          { key: 'd', label: 'กำหนดเสร็จ', render: (it) => <span className="whitespace-nowrap">{fmtDate(it.target_date)}</span> },
          { key: 'p', label: 'ความคืบหน้า', render: (it) => canEdit
            ? <div className="w-40"><Select value={it.progress} onChange={(e) => setProgress(it, e.target.value)}>{[0, 20, 40, 60, 80, 100].map((p) => <option key={p} value={p}>{p}%</option>)}</Select></div>
            : `${it.progress}%` },
          { key: 's', label: 'สถานะ', render: (it) => <Badge status={it.status}>{LABELS.itemStatus[it.status]}</Badge> },
          { key: 'a', label: '', render: (it) => <div className="flex gap-1">
            {it.course_id && it.status !== 'completed' && canEdit && <Button size="sm" variant="ghost" onClick={() => enrollFromItem(it)}>ลงทะเบียน</Button>}
            {canEdit && <button className="p-1 text-slate-300 hover:text-rose-500" onClick={() => remove('idp_items', it.id)}><Trash2 size={15} /></button>}
          </div> },
        ]} />
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Skill Gap เทียบกับตำแหน่งเป้าหมาย">
          {gaps.length ? gaps.map((g) => (
            <div key={g.competency.id} className="mb-3">
              <div className="mb-1 flex justify-between text-sm"><span>{g.competency.name}</span><span className="text-slate-500">{g.current} / {g.required} <span className="text-rose-500">(-{g.gap})</span></span></div>
              <Progress value={(g.current / g.required) * 100} tone={g.gap >= 2 ? 'rose' : 'amber'} />
            </div>
          )) : <div className="text-sm text-slate-400">ไม่มี Gap — สมรรถนะครบตามที่ตำแหน่งต้องการ</div>}
        </Card>
        <Card title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-amber-500" />หลักสูตรแนะนำ</span>}>
          {recs.map(({ course, reasons }) => (
            <div key={course.id} className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0"><Link to={`/courses/${course.id}`} className="block truncate text-sm font-medium hover:text-brand-600">{course.title}</Link><div className="truncate text-xs text-slate-400">{reasons.join(', ') || 'ภาคบังคับ'}</div></div>
              {canEdit && <Button size="sm" variant="secondary" onClick={async () => {
                const comp = data.course_competencies.find((cc) => cc.course_id === course.id)
                await insert('idp_items', { idp_id: idp.id, competency_id: comp?.competency_id || null, method: 'training', course_id: course.id, title: course.title, target_date: `${CURRENT_YEAR + 1}-03-31`, progress: 0, status: 'not_started' })
                notify('เพิ่มลง IDP แล้ว')
              }}><Plus size={14} />เพิ่ม</Button>}
            </div>
          ))}
          {!recs.length && <div className="text-sm text-slate-400">ไม่มีหลักสูตรแนะนำ</div>}
        </Card>
      </div>

      {adding && <AddItem idp={idp} gaps={gaps} onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddItem({ idp, gaps, onClose }) {
  const { data, insert, notify } = useStore()
  const [f, setF] = useState({ competency_id: gaps[0]?.competency.id || data.competencies[0].id, method: 'ojt', course_id: '', title: '', target_date: `${CURRENT_YEAR + 1}-03-31` })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const courses = data.courses.filter((c) => data.course_competencies.some((cc) => cc.course_id === c.id && cc.competency_id === f.competency_id))
  const save = async () => {
    const course = data.courses.find((c) => c.id === f.course_id)
    const title = f.title || course?.title
    if (!title) return notify('กรุณาระบุชื่อกิจกรรม', 'error')
    await insert('idp_items', { idp_id: idp.id, competency_id: f.competency_id, method: f.method, course_id: f.course_id || null, title, target_date: f.target_date, progress: 0, status: 'not_started' })
    notify('เพิ่มกิจกรรมแล้ว'); onClose()
  }
  return (
    <Modal open onClose={onClose} title="เพิ่มกิจกรรมพัฒนา" footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึก</Button></>}>
      <div className="space-y-3">
        <Field label="สมรรถนะที่ต้องการพัฒนา"><Select value={f.competency_id} onChange={set('competency_id')}>
          {gaps.length > 0 && <optgroup label="มี Gap">{gaps.map((g) => <option key={g.competency.id} value={g.competency.id}>{g.competency.name} (Gap {g.gap})</option>)}</optgroup>}
          <optgroup label="ทั้งหมด">{data.competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
        </Select></Field>
        <Field label="วิธีการพัฒนา"><Select value={f.method} onChange={set('method')} options={Object.entries(LABELS.method).map(([value, label]) => ({ value, label }))} /></Field>
        {f.method === 'training' && <Field label="หลักสูตร"><Select value={f.course_id} onChange={set('course_id')}><option value="">— เลือกหลักสูตร —</option>{(courses.length ? courses : data.courses).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>}
        <Field label="รายละเอียดกิจกรรม" hint={f.method === 'ojt' ? 'เช่น รับผิดชอบเปิดสาขาใหม่, หมุนเวียนงานแผนก' : f.method === 'coaching' ? 'เช่น Coaching กับผู้จัดการเขตเดือนละ 1 ครั้ง' : ''}><Input value={f.title} onChange={set('title')} /></Field>
        <Field label="กำหนดเสร็จ"><Input type="date" value={f.target_date} onChange={set('target_date')} /></Field>
      </div>
    </Modal>
  )
}
