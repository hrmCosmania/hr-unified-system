import { Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CertificateModal from '../components/Certificate'
import { Badge, Button, Card, cx, Field, Input, Modal, PageHeader, Select, Table, Tabs } from '../components/ui'
import { expiringCerts } from '../lib/analytics'
import { fmtBaht, fmtDate, fmtRange, fullName, LABELS, thMonth, TODAY } from '../lib/format'
import { useStore } from '../lib/store'

export default function Training() {
  const { data, idx, isHR, me, visibleEmpIds } = useStore()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'sessions'
  const setTab = (t) => setSp({ tab: t })

  const scopeApprove = (e) => isHR ? true : idx.emp[e.employee_id]?.manager_id === me.employee?.id
  const pending = data.enrollments.filter((e) => e.status === 'requested' && scopeApprove(e))
  const toEval = data.enrollments.filter((e) => e.status === 'completed' && e.behavior_score == null && visibleEmpIds.has(e.employee_id) && e.employee_id !== me.employee?.id && new Date(idx.session[e.session_id]?.end_date).getFullYear() === 2026)
  const certs = data.certificates.filter((c) => visibleEmpIds.has(c.employee_id))

  return (
    <div>
      <PageHeader title="จัดการการอบรม" subtitle="วางแผนรุ่นอบรม อนุมัติ ติดตามการเข้าร่วม ประเมินผล และออกใบประกาศนียบัตร" crumbs={[{ label: 'HRD', to: '/' }, { label: 'จัดการการอบรม' }]} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'sessions', label: 'รุ่นอบรม', count: data.training_sessions.length },
        { value: 'calendar', label: 'ปฏิทินการอบรม' },
        { value: 'approve', label: 'อนุมัติการลงทะเบียน', count: pending.length },
        { value: 'evaluate', label: 'ประเมินผลหลังอบรม (L3)', count: toEval.length },
        { value: 'certs', label: 'ใบประกาศนียบัตร', count: certs.length },
        ...(isHR ? [{ value: 'trainers', label: 'วิทยากร', count: data.trainers.length }] : []),
      ]} />
      {tab === 'sessions' && <Sessions />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'approve' && <Approve rows={pending} />}
      {tab === 'evaluate' && <Evaluate rows={toEval} />}
      {tab === 'certs' && <Certs rows={certs} />}
      {tab === 'trainers' && <Trainers />}
    </div>
  )
}

function Sessions() {
  const { data, idx, isHR } = useStore()
  const nav = useNavigate()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const rows = data.training_sessions.filter((s) => (!status || s.status === status) && (!q || idx.course[s.course_id]?.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="w-64"><Input placeholder="ค้นหาหลักสูตร" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="w-48"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(LABELS.sessionStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div className="ml-auto text-sm text-slate-400 self-center">เปิดรุ่นใหม่ได้จากหน้ารายละเอียดหลักสูตร</div>
      </div>
      <Table rows={rows} max={100} onRowClick={(s) => nav(`/training/sessions/${s.id}`)} columns={[
        { key: 'c', label: 'หลักสูตร', render: (s) => <div><div className="font-medium">{idx.course[s.course_id]?.title}</div><div className="text-xs text-slate-400">รุ่นที่ {s.batch_no} · {idx.trainer[s.trainer_id]?.name}</div></div> },
        { key: 'd', label: 'วันที่', render: (s) => <span className="whitespace-nowrap text-slate-500">{fmtRange(s.start_date, s.end_date)}</span> },
        { key: 'v', label: 'สถานที่', className: 'hidden lg:table-cell', render: (s) => <span className="text-slate-500">{s.venue}</span> },
        { key: 'n', label: 'ผู้เข้าอบรม', render: (s) => `${(idx.enrollBySession[s.id] || []).filter((e) => e.status !== 'rejected').length}/${s.capacity}` },
        ...(isHR ? [{ key: 'cost', label: 'งบประมาณ', render: (s) => fmtBaht(s.cost) }] : []),
        { key: 's', label: 'สถานะ', render: (s) => <Badge status={s.status}>{LABELS.sessionStatus[s.status]}</Badge> },
      ]} />
    </Card>
  )
}

function Calendar() {
  const { data, idx } = useStore()
  const nav = useNavigate()
  const [ym, setYm] = useState({ y: TODAY.getFullYear(), m: TODAY.getMonth() })
  const first = new Date(ym.y, ym.m, 1)
  const startPad = first.getDay()
  const days = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((startPad + days) / 7) * 7 }, (_, i) => i - startPad + 1)
  const byDay = useMemo(() => {
    const m = {}
    for (const s of data.training_sessions) {
      const a = new Date(s.start_date); const b = new Date(s.end_date)
      for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === ym.y && d.getMonth() === ym.m) (m[d.getDate()] ||= []).push(s)
      }
    }
    return m
  }, [data, ym])
  const move = (n) => { const d = new Date(ym.y, ym.m + n, 1); setYm({ y: d.getFullYear(), m: d.getMonth() }) }
  const colors = { Leadership: 'bg-blue-100 text-blue-800', Functional: 'bg-teal-100 text-teal-800', 'Soft Skill': 'bg-violet-100 text-violet-800', Safety: 'bg-amber-100 text-amber-800', Compliance: 'bg-rose-100 text-rose-800', Digital: 'bg-sky-100 text-sky-800' }
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => move(-1)}><ChevronLeft size={16} /></Button>
        <div className="w-40 text-center text-lg font-semibold">{thMonth(ym.m)} {ym.y + 543}</div>
        <Button variant="secondary" size="sm" onClick={() => move(1)}><ChevronRight size={16} /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-100 text-sm">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => <div key={d} className="bg-slate-50 py-2 text-center text-xs font-medium text-slate-500">{d}</div>)}
        {cells.map((d, i) => {
          const list = (byDay[d] || []).filter((s) => idx.course[s.course_id]?.format !== 'e-learning')
          const isToday = d === TODAY.getDate() && ym.m === TODAY.getMonth() && ym.y === TODAY.getFullYear()
          return (
            <div key={i} className={cx('min-h-24 bg-white p-1.5', (d < 1 || d > days) && 'bg-slate-50/60')}>
              {d >= 1 && d <= days && <div className={cx('mb-1 text-xs', isToday ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white' : 'text-slate-400')}>{d}</div>}
              {d >= 1 && d <= days && list.slice(0, 3).map((s) => {
                const c = idx.course[s.course_id]
                return <button key={s.id} onClick={() => nav(`/training/sessions/${s.id}`)} className={cx('mb-0.5 block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]', colors[c.category])}>{c.title}</button>
              })}
              {list.length > 3 && <div className="text-[11px] text-slate-400">+{list.length - 3} รายการ</div>}
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-xs text-slate-400">* ไม่แสดงหลักสูตร e-Learning ที่เรียนได้ตลอดช่วงเวลา</div>
    </Card>
  )
}

function Approve({ rows }) {
  const { idx, update, notify, me } = useStore()
  const [sel, setSel] = useState([])
  const act = async (ids, status) => {
    for (const id of ids) await update('enrollments', id, { status, approved_by: me.employee?.id || null, approved_at: new Date().toISOString() })
    setSel([]); notify(status === 'approved' ? `อนุมัติ ${ids.length} รายการแล้ว` : `ไม่อนุมัติ ${ids.length} รายการ`)
  }
  return (
    <Card>
      {sel.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-brand-50 p-2 text-sm">
          <span className="px-2">เลือก {sel.length} รายการ</span>
          <Button size="sm" variant="success" onClick={() => act(sel, 'approved')}><Check size={14} />อนุมัติทั้งหมด</Button>
          <Button size="sm" variant="secondary" onClick={() => act(sel, 'rejected')}><X size={14} />ไม่อนุมัติ</Button>
        </div>
      )}
      <Table rows={rows} max={150} empty="ไม่มีคำขอรออนุมัติ 🎉" columns={[
        { key: 'x', label: <input type="checkbox" checked={sel.length === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} />, render: (r) => <input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /> },
        { key: 'e', label: 'พนักงาน', render: (r) => { const e = idx.emp[r.employee_id]; return <div><div className="font-medium">{fullName(e)}</div><div className="text-xs text-slate-400">{idx.pos[e.position_id]?.name} · {idx.dept[e.department_id]?.name}</div></div> } },
        { key: 'c', label: 'หลักสูตร', render: (r) => { const s = idx.session[r.session_id]; return <div><div>{idx.course[s.course_id]?.title}</div><div className="text-xs text-slate-400">รุ่นที่ {s.batch_no} · {fmtRange(s.start_date, s.end_date)}</div></div> } },
        { key: 'src', label: 'ที่มา', render: (r) => <Badge tone="slate">{{ self: 'สมัครเอง', idp: 'จาก IDP', manager: 'หัวหน้า', hr: 'HR', mandatory: 'ภาคบังคับ' }[r.source]}</Badge> },
        { key: 'a', label: '', render: (r) => <div className="flex gap-1"><Button size="sm" variant="success" onClick={() => act([r.id], 'approved')}>อนุมัติ</Button><Button size="sm" variant="secondary" onClick={() => act([r.id], 'rejected')}>ไม่อนุมัติ</Button></div> },
      ]} />
    </Card>
  )
}

function Evaluate({ rows }) {
  const { idx, update, notify } = useStore()
  const [scores, setScores] = useState({})
  const save = async (r) => {
    const v = Number(scores[r.id])
    if (!v) return
    await update('enrollments', r.id, { behavior_score: v, result_note: scores[r.id + 'n'] || null })
    notify('บันทึกผลประเมินพฤติกรรมหลังอบรมแล้ว')
  }
  return (
    <Card>
      <p className="mb-3 text-sm text-slate-500">Kirkpatrick Level 3 — หัวหน้างานประเมินการนำความรู้ไปใช้ในงานจริง (1 = ไม่เปลี่ยนแปลง, 5 = นำไปใช้ได้ดีเยี่ยมและถ่ายทอดผู้อื่นได้)</p>
      <Table rows={rows} max={60} empty="ไม่มีรายการรอประเมิน" columns={[
        { key: 'e', label: 'พนักงาน', render: (r) => fullName(idx.emp[r.employee_id]) },
        { key: 'c', label: 'หลักสูตร', render: (r) => idx.course[idx.session[r.session_id].course_id]?.title },
        { key: 'd', label: 'อบรมเมื่อ', render: (r) => fmtDate(idx.session[r.session_id].end_date) },
        { key: 'l2', label: 'Pre → Post', render: (r) => <span className="whitespace-nowrap">{r.pre_score} → <b>{r.post_score}</b></span> },
        { key: 's', label: 'คะแนน L3', render: (r) => <div className="w-24"><Select value={scores[r.id] || ''} onChange={(e) => setScores({ ...scores, [r.id]: e.target.value })}><option value="">-</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select></div> },
        { key: 'n', label: 'ผลลัพธ์ต่องาน (L4)', render: (r) => <Input placeholder="เช่น ลดของเสีย 5%" value={scores[r.id + 'n'] || ''} onChange={(e) => setScores({ ...scores, [r.id + 'n']: e.target.value })} /> },
        { key: 'a', label: '', render: (r) => <Button size="sm" disabled={!scores[r.id]} onClick={() => save(r)}>บันทึก</Button> },
      ]} />
    </Card>
  )
}

function Certs({ rows }) {
  const { data, idx } = useStore()
  const [filter, setFilter] = useState('all')
  const [cert, setCert] = useState(null)
  const exp = new Set(expiringCerts(data, 60).map((c) => c.id))
  const list = rows.filter((c) => filter === 'all' || (filter === 'expiring' && exp.has(c.id) && new Date(c.expires_at) >= TODAY) || (filter === 'expired' && c.expires_at && new Date(c.expires_at) < TODAY))
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
  return (
    <Card>
      <div className="mb-3 w-60"><Select value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: 'all', label: 'ทั้งหมด' }, { value: 'expiring', label: 'ใกล้หมดอายุ (60 วัน)' }, { value: 'expired', label: 'หมดอายุแล้ว' }]} /></div>
      <Table rows={list} max={100} columns={[
        { key: 'n', label: 'เลขที่', render: (r) => <span className="text-slate-500">{r.cert_no}</span> },
        { key: 'e', label: 'พนักงาน', render: (r) => fullName(idx.emp[r.employee_id]) },
        { key: 'c', label: 'หลักสูตร', render: (r) => idx.course[r.course_id]?.title },
        { key: 's', label: 'คะแนน', render: (r) => r.score },
        { key: 'i', label: 'ออกให้', render: (r) => fmtDate(r.issued_at) },
        { key: 'x', label: 'หมดอายุ', render: (r) => (r.expires_at ? <span className={new Date(r.expires_at) < TODAY ? 'text-rose-600' : exp.has(r.id) ? 'text-amber-600' : ''}>{fmtDate(r.expires_at)}</span> : '-') },
        { key: 'a', label: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => setCert(r)}>ดู</Button> },
      ]} />
      <CertificateModal cert={cert} onClose={() => setCert(null)} />
    </Card>
  )
}

function Trainers() {
  const { data, insert, notify } = useStore()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', type: 'external', expertise: '' })
  const save = async () => { if (!f.name) return; await insert('trainers', f); notify('เพิ่มวิทยากรแล้ว'); setOpen(false); setF({ name: '', type: 'external', expertise: '' }) }
  return (
    <Card title="ทะเบียนวิทยากร" action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={14} />เพิ่มวิทยากร</Button>}>
      <Table rows={data.trainers} columns={[
        { key: 'name', label: 'ชื่อ', render: (t) => <span className="font-medium">{t.name}</span> },
        { key: 'type', label: 'ประเภท', render: (t) => <Badge tone={t.type === 'internal' ? 'green' : 'blue'}>{t.type === 'internal' ? 'วิทยากรภายใน' : 'วิทยากรภายนอก'}</Badge> },
        { key: 'expertise', label: 'ความเชี่ยวชาญ' },
        { key: 'n', label: 'จำนวนรุ่น', render: (t) => data.training_sessions.filter((s) => s.trainer_id === t.id).length },
        { key: 'rating', label: 'คะแนนเฉลี่ย', render: (t) => (t.rating ? `★ ${Number(t.rating).toFixed(2)}` : '-') },
      ]} />
      <Modal open={open} onClose={() => setOpen(false)} title="เพิ่มวิทยากร" footer={<Button onClick={save}>บันทึก</Button>}>
        <div className="space-y-3">
          <Field label="ชื่อ"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="ประเภท"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: 'internal', label: 'ภายใน' }, { value: 'external', label: 'ภายนอก' }]} /></Field>
          <Field label="ความเชี่ยวชาญ"><Input value={f.expertise} onChange={(e) => setF({ ...f, expertise: e.target.value })} /></Field>
        </div>
      </Modal>
    </Card>
  )
}
