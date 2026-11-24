import { Award, CalendarDays, MapPin, Star, User, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, PageHeader, Select, Stat, Table } from '../components/ui'
import { fmtBaht, fmtNum, fmtRange, fullName, LABELS } from '../lib/format'
import { useStore } from '../lib/store'

export default function SessionDetail() {
  const { id } = useParams()
  const { idx, isHR, update, insert, notify, visibleEmpIds, data } = useStore()
  const s = idx.session[id]
  const [edits, setEdits] = useState({})
  const [busy, setBusy] = useState(false)
  if (!s) return <div className="text-slate-400">ไม่พบรุ่นอบรม</div>
  const c = idx.course[s.course_id]
  const ens = (idx.enrollBySession[s.id] || []).filter((e) => isHR || visibleEmpIds.has(e.employee_id))
  const active = ens.filter((e) => e.status !== 'rejected')
  const scored = ens.filter((e) => e.post_score != null)
  const sat = ens.filter((e) => e.satisfaction != null)
  const passed = ens.filter((e) => e.status === 'completed').length
  const val = (e, k) => (edits[e.id]?.[k] ?? e[k] ?? '')
  const set = (e, k, v) => setEdits({ ...edits, [e.id]: { ...edits[e.id], [k]: v } })

  const saveResults = async () => {
    setBusy(true)
    try {
      let certs = 0
      for (const e of active) {
        const ed = edits[e.id]
        if (!ed) continue
        const patch = {}
        for (const k of ['attended_hours', 'pre_score', 'post_score', 'satisfaction']) if (ed[k] !== undefined && ed[k] !== '') patch[k] = Number(ed[k])
        if (ed.absent) Object.assign(patch, { status: 'no_show' })
        else if (patch.post_score != null) patch.status = patch.post_score >= c.pass_score ? 'completed' : 'failed'
        else if (patch.attended_hours != null) patch.status = 'attended'
        await update('enrollments', e.id, patch)
        if (patch.status === 'completed' && !data.certificates.some((x) => x.enrollment_id === e.id)) {
          const exp = c.validity_months ? new Date(new Date(s.end_date).setMonth(new Date(s.end_date).getMonth() + c.validity_months)).toISOString().slice(0, 10) : null
          await insert('certificates', { cert_no: `PG-${s.end_date.slice(0, 4)}-${Date.now().toString().slice(-6)}${certs}`, enrollment_id: e.id, employee_id: e.employee_id, course_id: c.id, score: patch.post_score, issued_at: s.end_date, expires_at: exp })
          certs++
        }
      }
      setEdits({})
      notify(`บันทึกผลแล้ว${certs ? ` · ออกใบประกาศ ${certs} ใบ` : ''}`)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title={`${c.title} — รุ่นที่ ${s.batch_no}`} crumbs={[{ label: 'จัดการการอบรม', to: '/training' }, { label: c.code, to: `/courses/${c.id}` }, { label: `รุ่นที่ ${s.batch_no}` }]}
        actions={isHR && (
          <div className="w-48"><Select value={s.status} onChange={(e) => update('training_sessions', s.id, { status: e.target.value }).then(() => notify('อัปเดตสถานะแล้ว'))}
            options={Object.entries(LABELS.sessionStatus).map(([value, label]) => ({ value, label }))} /></div>
        )} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="ผู้เข้าอบรม" value={`${active.length}/${s.capacity}`} tone="blue" />
        <Stat icon={Award} label="ผ่านการประเมิน" value={passed} unit="คน" sub={scored.length ? `อัตราผ่าน ${Math.round((passed / scored.length) * 100)}%` : ''} tone="green" />
        <Stat icon={Star} label="ความพึงพอใจ (L1)" value={sat.length ? (sat.reduce((a, e) => a + Number(e.satisfaction), 0) / sat.length).toFixed(2) : '-'} unit="/ 5" tone="amber" />
        <Stat icon={CalendarDays} label="คะแนนเพิ่มขึ้นเฉลี่ย (L2)" value={scored.length ? `+${fmtNum(scored.reduce((a, e) => a + (e.post_score - (e.pre_score || 0)), 0) / scored.length, 1)}` : '-'} tone="violet" />
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
          <span className="flex items-center gap-2"><CalendarDays size={16} />{fmtRange(s.start_date, s.end_date)} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)} น.</span>
          <span className="flex items-center gap-2"><MapPin size={16} />{s.venue}</span>
          <span className="flex items-center gap-2"><User size={16} />{idx.trainer[s.trainer_id]?.name}</span>
          {isHR && <span>งบประมาณ {fmtBaht(s.cost)} · {fmtBaht(s.cost / Math.max(1, active.length))}/คน</span>}
          <Badge status={s.status}>{LABELS.sessionStatus[s.status]}</Badge>
        </div>
      </Card>

      <Card title="รายชื่อผู้เข้าอบรม และบันทึกผล" action={isHR && <Button disabled={!Object.keys(edits).length || busy} onClick={saveResults}>{busy ? 'กำลังบันทึก…' : 'บันทึกผล & ออกใบประกาศ'}</Button>}>
        <Table rows={ens} empty="ยังไม่มีผู้ลงทะเบียน" columns={[
          { key: 'e', label: 'พนักงาน', render: (e) => { const emp = idx.emp[e.employee_id]; return <Link to={`/employees/${emp.id}`} className="hover:text-brand-600"><div className="font-medium">{fullName(emp)}</div><div className="text-xs text-slate-400">{emp.employee_code} · {idx.pos[emp.position_id]?.name}</div></Link> } },
          { key: 'st', label: 'สถานะ', render: (e) => <Badge status={e.status}>{LABELS.enrollStatus[e.status]}</Badge> },
          ...['attended_hours', 'pre_score', 'post_score', 'satisfaction'].map((k) => ({
            key: k, label: { attended_hours: 'ชม.เข้าอบรม', pre_score: 'Pre-test', post_score: 'Post-test', satisfaction: 'พึงพอใจ (1-5)' }[k],
            render: (e) => isHR && e.status !== 'rejected'
              ? <input type="number" step={k === 'satisfaction' ? 0.1 : 1} value={val(e, k)} onChange={(ev) => set(e, k, ev.target.value)} className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" />
              : e[k] ?? '-',
          })),
          ...(isHR ? [{ key: 'ab', label: 'ขาด', render: (e) => e.status !== 'rejected' && <input type="checkbox" checked={!!edits[e.id]?.absent} onChange={(ev) => set(e, 'absent', ev.target.checked)} /> }] : []),
        ]} />
        {isHR && <p className="mt-3 text-xs text-slate-400">ระบบจะตัดสินผ่าน/ไม่ผ่านจากคะแนน Post-test (เกณฑ์ {c.pass_score}) และออกใบประกาศนียบัตรให้อัตโนมัติ · ชั่วโมงอบรมจะถูกส่งต่อไปยังระบบ Time & Attendance</p>}
      </Card>
    </div>
  )
}
