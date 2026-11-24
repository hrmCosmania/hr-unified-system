import { AlertTriangle, Plus, ShieldCheck, Star, Trophy, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, cx, Field, Modal, PageHeader, Select, Stat, Table, Tabs } from '../components/ui'
import { promotionReadiness } from '../lib/analytics'
import { fullName, LABELS } from '../lib/format'
import { useStore } from '../lib/store'

const BOX = {
  '3-3': ['Star', 'ดาวเด่น — เตรียมเลื่อนตำแหน่ง', 'bg-emerald-500'], '3-2': ['High Potential', 'ศักยภาพสูง — มอบหมายงานท้าทาย', 'bg-emerald-400'], '2-3': ['High Performer', 'ผลงานเด่น — ขยายบทบาท', 'bg-emerald-400'],
  '3-1': ['Enigma', 'ศักยภาพสูงแต่ผลงานต่ำ — Coaching', 'bg-amber-300'], '2-2': ['Core Player', 'กำลังหลัก — พัฒนาต่อเนื่อง', 'bg-sky-300'], '1-3': ['Solid Performer', 'ผลงานดี — เชี่ยวชาญในงาน', 'bg-sky-300'],
  '2-1': ['Inconsistent', 'ต้องติดตามผลงาน', 'bg-amber-200'], '1-2': ['Effective', 'ทำงานได้ตามมาตรฐาน', 'bg-slate-200'], '1-1': ['Under Performer', 'แผนปรับปรุงผลงาน (PIP)', 'bg-rose-200'],
}

export default function Talent() {
  const [tab, setTab] = useState('ninebox')
  return (
    <div>
      <PageHeader title="Talent & Succession" subtitle="บริหารกลุ่ม Talent และแผนสืบทอดตำแหน่งสำคัญ เพื่อความต่อเนื่องทางธุรกิจ" crumbs={[{ label: 'HRD', to: '/' }, { label: 'Talent & Succession' }]} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'ninebox', label: '9-Box Talent Review' }, { value: 'succession', label: 'แผนสืบทอดตำแหน่ง' }]} />
      {tab === 'ninebox' ? <NineBox /> : <Succession />}
    </div>
  )
}

function NineBox() {
  const { data, idx, visibleEmpIds } = useStore()
  const [bu, setBu] = useState('')
  const [cell, setCell] = useState('3-3')
  const reviews = useMemo(() => data.talent_reviews.filter((r) => r.year === 2026 && visibleEmpIds.has(r.employee_id) && (!bu || idx.emp[r.employee_id]?.business_unit_id === bu)), [data, idx, visibleEmpIds, bu])
  const grid = {}
  reviews.forEach((r) => (grid[`${r.potential}-${r.performance}`] ||= []).push(r))
  const talents = reviews.filter((r) => r.performance + r.potential >= 5)
  const list = (grid[cell] || []).map((r) => ({ ...r, e: idx.emp[r.employee_id] }))
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="พนักงานที่ผ่าน Talent Review" value={reviews.length} unit="คน" tone="blue" />
        <Stat icon={Star} label="กลุ่ม Talent" value={talents.length} unit="คน" sub={`${Math.round((talents.length / Math.max(1, reviews.length)) * 100)}%`} tone="violet" />
        <Stat icon={AlertTriangle} label="Talent ที่เสี่ยงลาออกสูง" value={talents.filter((r) => r.flight_risk === 'high').length} unit="คน" tone="rose" />
        <Stat icon={ShieldCheck} label="ตำแหน่งสำคัญที่มีผู้สืบทอดพร้อม" value={data.succession_plans.filter((p) => (idx.candByPlan[p.id] || []).some((c) => c.readiness === 'ready_now')).length + '/' + data.succession_plans.length} tone="green" />
      </div>
      <div className="w-64"><Select value={bu} onChange={(e) => setBu(e.target.value)}><option value="">ทุกสายธุรกิจ</option>{data.business_units.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card title="9-Box Grid (ผลงาน × ศักยภาพ)">
          <div className="flex gap-2">
            <div className="flex w-6 items-center justify-center"><span className="-rotate-90 whitespace-nowrap text-xs text-slate-400">ศักยภาพ (Potential) →</span></div>
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-2">
                {[3, 2, 1].flatMap((pot) => [1, 2, 3].map((perf) => {
                  const k = `${pot}-${perf}`; const [name, , color] = BOX[k]; const n = (grid[k] || []).length
                  return (
                    <button key={k} onClick={() => setCell(k)} className={cx('flex aspect-[1.4] flex-col justify-between rounded-xl p-3 text-left transition', color, cell === k ? 'ring-4 ring-navy-800/40' : 'hover:opacity-90')}>
                      <span className="text-xs font-semibold text-navy-900">{name}</span>
                      <span className="text-3xl font-bold text-navy-900">{n}</span>
                    </button>
                  )
                }))}
              </div>
              <div className="mt-2 grid grid-cols-3 text-center text-xs text-slate-400"><span>ต่ำ</span><span>ผลงาน (Performance) →</span><span>สูง</span></div>
            </div>
          </div>
        </Card>
        <Card title={`${BOX[cell][0]} — ${BOX[cell][1]}`}>
          <Table rows={list} max={40} empty="ไม่มีพนักงานในกลุ่มนี้" columns={[
            { key: 'e', label: 'พนักงาน', render: (r) => <Link to={`/employees/${r.e.id}`} className="flex items-center gap-2 hover:text-brand-600"><Avatar emp={r.e} size={30} /><div><div className="font-medium">{fullName(r.e)}</div><div className="text-xs text-slate-400">{idx.pos[r.e.position_id]?.name}</div></div></Link> },
            { key: 'b', label: 'สายงาน', render: (r) => <span className="text-xs text-slate-500">{idx.bu[r.e.business_unit_id]?.name}</span> },
            { key: 'f', label: 'เสี่ยงลาออก', render: (r) => <Badge status={r.flight_risk}>{LABELS.risk[r.flight_risk]}</Badge> },
          ]} />
        </Card>
      </div>
    </div>
  )
}

function Succession() {
  const { data, idx, isHR, insert, notify } = useStore()
  const [adding, setAdding] = useState(null)
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {data.succession_plans.map((p) => {
        const inc = idx.emp[p.incumbent_id]
        const cands = (idx.candByPlan[p.id] || []).slice().sort((a, b) => b.readiness_pct - a.readiness_pct)
        const ready = cands.some((c) => c.readiness === 'ready_now')
        return (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><Trophy size={18} className="text-amber-500" /><b className="text-navy-900">{idx.pos[p.position_id]?.name}</b></div>
                <div className="text-sm text-slate-500">{idx.dept[p.department_id]?.name} · ผู้ดำรงตำแหน่ง: {fullName(inc)}</div>
              </div>
              <div className="text-right"><Badge status={p.vacancy_risk}>ความเสี่ยง{LABELS.risk[p.vacancy_risk]}</Badge>{!ready && <div className="mt-1"><Badge tone="rose">ยังไม่มีผู้พร้อมทันที</Badge></div>}</div>
            </div>
            <div className="mt-4 space-y-2.5">
              {cands.map((c) => {
                const e = idx.emp[c.employee_id]
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                    <Avatar emp={e} size={34} />
                    <div className="min-w-0 flex-1"><Link to={`/employees/${e.id}`} className="block truncate text-sm font-medium hover:text-brand-600">{fullName(e)}</Link><div className="truncate text-xs text-slate-400">{idx.pos[e.position_id]?.name}</div></div>
                    <Badge status={c.readiness}>{LABELS.readiness[c.readiness]}</Badge>
                    <b className="w-10 text-right text-sm">{c.readiness_pct}%</b>
                  </div>
                )
              })}
              {!cands.length && <div className="text-sm text-slate-400">ยังไม่มีผู้สืบทอด</div>}
            </div>
            {isHR && <Button size="sm" variant="ghost" className="mt-3" onClick={() => setAdding(p)}><Plus size={14} />เพิ่มผู้สืบทอด</Button>}
          </Card>
        )
      })}
      {adding && <AddCandidate plan={adding} onClose={() => setAdding(null)} onSave={async (row) => { await insert('succession_candidates', row); notify('เพิ่มผู้สืบทอดแล้ว'); setAdding(null) }} data={data} idx={idx} />}
    </div>
  )
}

function AddCandidate({ plan, onClose, onSave, data, idx }) {
  const pos = idx.pos[plan.position_id]
  const path = data.career_paths.find((x) => x.to_position_id === plan.position_id)
  const existing = new Set((idx.candByPlan[plan.id] || []).map((c) => c.employee_id))
  const options = data.employees.filter((e) => !existing.has(e.id) && e.id !== plan.incumbent_id && idx.pos[e.position_id]?.career_track === pos.career_track && idx.pos[e.position_id]?.job_level < pos.job_level && e.status === 'active')
    .map((e) => ({ e, r: path ? promotionReadiness(data, idx, e.id, { ...path, from_position_id: e.position_id }) : null }))
    .sort((a, b) => (b.r?.score || 0) - (a.r?.score || 0)).slice(0, 40)
  const [sel, setSel] = useState(options[0]?.e.id)
  const [readiness, setReadiness] = useState('1_2_years')
  const chosen = options.find((o) => o.e.id === sel)
  return (
    <Modal open onClose={onClose} title={`เพิ่มผู้สืบทอด: ${pos.name}`} footer={<Button disabled={!sel} onClick={() => onSave({ plan_id: plan.id, employee_id: sel, readiness, readiness_pct: chosen?.r?.score || 50 })}>บันทึก</Button>}>
      <div className="space-y-3">
        <Field label="พนักงาน (เรียงตามความพร้อม)"><Select value={sel} onChange={(e) => setSel(e.target.value)} options={options.map(({ e, r }) => ({ value: e.id, label: `${fullName(e)} — ${idx.pos[e.position_id]?.name} (${r?.score ?? '-'}%)` }))} /></Field>
        <Field label="ระดับความพร้อม"><Select value={readiness} onChange={(e) => setReadiness(e.target.value)} options={Object.entries(LABELS.readiness).map(([value, label]) => ({ value, label }))} /></Field>
      </div>
    </Modal>
  )
}
