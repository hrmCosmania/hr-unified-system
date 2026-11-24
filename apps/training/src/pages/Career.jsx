import { ArrowRight, CheckCircle2, Circle, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, cx, Field, Input, Modal, PageHeader, Progress, Select, Table } from '../components/ui'
import { promotionReadiness } from '../lib/analytics'
import { fullName, LABELS } from '../lib/format'
import { useStore } from '../lib/store'

export default function Career() {
  const { data, idx, me, isManager, isHR, visibleEmpIds } = useStore()
  const myPos = idx.pos[me.employee?.position_id]
  const [track, setTrack] = useState(myPos?.career_track || 'store')
  const [editing, setEditing] = useState(null)
  const positions = data.positions.filter((p) => p.career_track === track).sort((a, b) => a.job_level - b.job_level)
  const paths = data.career_paths

  const myPath = me.employee && paths.find((p) => p.from_position_id === me.employee.position_id)
  const myReady = myPath && promotionReadiness(data, idx, me.employee.id, myPath)

  const pipeline = useMemo(() => {
    if (!isManager) return []
    return data.employees.filter((e) => visibleEmpIds.has(e.id) && e.id !== me.employee?.id && e.status === 'active' && idx.pos[e.position_id]?.career_track === track)
      .map((e) => { const p = paths.find((x) => x.from_position_id === e.position_id); return p ? { e, p, r: promotionReadiness(data, idx, e.id, p) } : null })
      .filter(Boolean).sort((a, b) => b.r.score - a.r.score).slice(0, 30)
  }, [data, idx, visibleEmpIds, track, isManager, me, paths])

  return (
    <div>
      <PageHeader title="เส้นทางความก้าวหน้า" subtitle="Career Path — เห็นเส้นทางเติบโตชัดเจน รู้ว่าต้องพัฒนาอะไรเพื่อก้าวสู่ตำแหน่งถัดไป" crumbs={[{ label: 'HRD', to: '/' }, { label: 'เส้นทางความก้าวหน้า' }]} />

      {myReady && (
        <Card className="mb-5" title="ความพร้อมของคุณสู่ตำแหน่งถัดไป">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center justify-center">
              <Ring value={myReady.score} />
              <div className="mt-2 text-center text-sm"><div className="text-slate-500">{myPos?.name}</div><ArrowRight size={16} className="mx-auto my-1 text-slate-300" /><b className="text-brand-700">{idx.pos[myPath.to_position_id]?.name}</b></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Factor label="สมรรถนะตามตำแหน่งเป้าหมาย (50%)" v={myReady.compFit} />
              <Factor label="หลักสูตรที่กำหนด (25%)" v={myReady.courseFit} />
              <Factor label={`อายุงาน (ขั้นต่ำ ${myPath.min_years} ปี) (15%)`} v={myReady.tenure} />
              <Factor label={`ผลประเมินขั้นต่ำ ${myPath.min_performance} (10%)`} v={myReady.perfFit} />
              <div className="sm:col-span-2">
                <div className="mb-2 text-sm font-medium">หลักสูตรที่ต้องผ่าน</div>
                <div className="flex flex-wrap gap-2">{myReady.requiredCourses.map(({ course, done }) => course && (
                  <Link key={course.id} to={`/courses/${course.id}`} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1', done ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-300')}>
                    {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}{course.title}
                  </Link>
                ))}</div>
                <Link to="/idp" className="mt-3 inline-block text-sm text-brand-600">วางแผนพัฒนา (IDP) เพื่อปิด Gap →</Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-5 flex flex-wrap gap-2">
          {Object.entries(LABELS.track).map(([k, v]) => (
            <button key={k} onClick={() => setTrack(k)} className={cx('rounded-full px-4 py-1.5 text-sm ring-1', track === k ? 'bg-navy-800 text-white ring-navy-800' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>{v}</button>
          ))}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {positions.map((p, i) => {
            const path = paths.find((x) => x.to_position_id === p.id)
            const isMine = p.id === me.employee?.position_id
            const n = data.employees.filter((e) => e.position_id === p.id && e.status !== 'resigned').length
            return (
              <div key={p.id} className="flex items-stretch gap-3">
                <div className={cx('w-56 shrink-0 rounded-2xl p-4 ring-1', isMine ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-slate-200')}>
                  <div className={cx('text-xs', isMine ? 'text-blue-100' : 'text-slate-400')}>Level {p.job_level}{p.is_key_position && ' · Key Position'}</div>
                  <div className="mt-1 font-semibold leading-snug">{p.name}</div>
                  <div className={cx('mt-1 text-xs', isMine ? 'text-blue-100' : 'text-slate-500')}>{n} คนในตำแหน่ง{isMine && ' · ตำแหน่งของคุณ'}</div>
                  {path && (
                    <div className={cx('mt-3 border-t pt-2 text-xs', isMine ? 'border-white/20 text-blue-50' : 'border-slate-100 text-slate-500')}>
                      <div>อายุงานขั้นต่ำ {path.min_years} ปี · ผลงาน ≥ {path.min_performance}</div>
                      <ul className="mt-1 list-disc pl-4">{(path.required_course_ids || []).map((cid) => <li key={cid}>{idx.course[cid]?.title}</li>)}</ul>
                      {isHR && <button onClick={() => setEditing(path)} className={cx('mt-2 flex items-center gap-1', isMine ? 'text-white' : 'text-brand-600')}><Pencil size={12} />แก้ไขเงื่อนไข</button>}
                    </div>
                  )}
                </div>
                {i < positions.length - 1 && <ArrowRight className="shrink-0 self-center text-slate-300" />}
              </div>
            )
          })}
        </div>
      </Card>

      {isManager && (
        <Card className="mt-5" title={`ความพร้อมเลื่อนตำแหน่ง — ${LABELS.track[track]}`}>
          <Table rows={pipeline} max={30} empty="ไม่มีพนักงานในสายงานนี้" columns={[
            { key: 'e', label: 'พนักงาน', render: ({ e }) => <Link to={`/employees/${e.id}`} className="flex items-center gap-2 hover:text-brand-600"><Avatar emp={e} size={30} /><div><div className="font-medium">{fullName(e)}</div><div className="text-xs text-slate-400">{idx.dept[e.department_id]?.name}</div></div></Link> },
            { key: 'p', label: 'ตำแหน่งปัจจุบัน → ถัดไป', render: ({ e, p }) => <span className="text-slate-600">{idx.pos[e.position_id]?.name} → <b>{idx.pos[p.to_position_id]?.name}</b></span> },
            { key: 'r', label: 'ความพร้อม', render: ({ r }) => <div className="flex w-40 items-center gap-2"><Progress value={r.score} tone={r.score >= 80 ? 'green' : r.score >= 60 ? 'blue' : 'amber'} /><b className="text-xs">{r.score}%</b></div> },
            { key: 'g', label: 'Gap หลัก', render: ({ r }) => <span className="text-xs text-slate-500">{r.gaps.filter((g) => g.gap > 0).slice(0, 2).map((g) => g.competency.name).join(', ') || '-'}</span> },
            { key: 't', label: 'Talent', render: ({ e }) => idx.talentByEmp[e.id]?.is_talent ? <Badge tone="violet">Talent</Badge> : null },
          ]} />
        </Card>
      )}
      {editing && <EditPath path={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditPath({ path, onClose }) {
  const { data, idx, update, notify } = useStore()
  const [f, setF] = useState({ min_years: path.min_years, min_performance: path.min_performance, required_course_ids: path.required_course_ids || [] })
  const save = async () => { await update('career_paths', path.id, { ...f, min_years: Number(f.min_years) }); notify('บันทึกเงื่อนไขแล้ว'); onClose() }
  return (
    <Modal open onClose={onClose} title={`${idx.pos[path.from_position_id]?.name} → ${idx.pos[path.to_position_id]?.name}`} footer={<Button onClick={save}>บันทึก</Button>}>
      <div className="space-y-3">
        <Field label="อายุงานขั้นต่ำ (ปี)"><Input type="number" step="0.5" value={f.min_years} onChange={(e) => setF({ ...f, min_years: e.target.value })} /></Field>
        <Field label="ผลการประเมินขั้นต่ำ"><Select value={f.min_performance} onChange={(e) => setF({ ...f, min_performance: e.target.value })} options={['A', 'B', 'C'].map((v) => ({ value: v, label: v }))} /></Field>
        <Field label="หลักสูตรที่ต้องผ่าน">
          <div className="max-h-60 space-y-1 overflow-y-auto">{data.courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.required_course_ids.includes(c.id)} onChange={(e) => setF({ ...f, required_course_ids: e.target.checked ? [...f.required_course_ids, c.id] : f.required_course_ids.filter((x) => x !== c.id) })} />{c.title}</label>
          ))}</div>
        </Field>
      </div>
    </Modal>
  )
}

function Factor({ label, v }) {
  const p = Math.round(v * 100)
  return <div><div className="mb-1 flex justify-between text-sm"><span>{label}</span><b>{p}%</b></div><Progress value={p} tone={p >= 80 ? 'green' : p >= 50 ? 'blue' : 'amber'} /></div>
}

export function Ring({ value, size = 140 }) {
  const r = 52; const c = 2 * Math.PI * r
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#2f6fe4' : '#f59e0b'
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#eef2f7" strokeWidth="12" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontSize="24" fontWeight="700" fill="#0a2248">{value}%</text>
      <text x="60" y="76" textAnchor="middle" fontSize="10" fill="#64748b">ความพร้อม</text>
    </svg>
  )
}
