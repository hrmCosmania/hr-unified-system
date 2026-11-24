import { Plus, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, cx, Field, Input, Modal, PageHeader, Select, Table, Tabs } from '../components/ui'
import { competencyGap, currentLevels } from '../lib/analytics'
import { CURRENT_YEAR, fullName, LABELS } from '../lib/format'
import { useStore } from '../lib/store'

export default function Competency() {
  const { isManager, isHR } = useStore()
  const [tab, setTab] = useState('assess')
  return (
    <div>
      <PageHeader title="ประเมินสมรรถนะ" subtitle="Competency Management — กำหนดสมรรถนะตามตำแหน่ง ประเมิน และวิเคราะห์ Skill Gap" crumbs={[{ label: 'HRD', to: '/' }, { label: 'ประเมินสมรรถนะ' }]} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'assess', label: 'แบบประเมินสมรรถนะ' },
        ...(isManager ? [{ value: 'gap', label: 'Skill Gap ภาพรวม' }] : []),
        { value: 'dict', label: 'พจนานุกรมสมรรถนะ' },
        { value: 'matrix', label: 'สมรรถนะตามตำแหน่ง' },
      ]} />
      {tab === 'assess' && <Assess />}
      {tab === 'gap' && <GapOverview />}
      {tab === 'dict' && <Dictionary editable={isHR} />}
      {tab === 'matrix' && <Matrix editable={isHR} />}
    </div>
  )
}

function Assess() {
  const { data, idx, me, isManager, visibleEmpIds, insert, update, notify } = useStore()
  const team = data.employees.filter((e) => visibleEmpIds.has(e.id) && e.status !== 'resigned')
  const [empId, setEmpId] = useState(me.employee?.id || team[0]?.id)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState({})
  const emp = idx.emp[empId]
  if (!emp) return null
  const isSelf = emp.id === me.employee?.id
  const gaps = competencyGap(idx, emp.id)
  const existing = Object.fromEntries((idx.assessByEmp[emp.id] || []).filter((a) => a.period === String(CURRENT_YEAR)).map((a) => [a.competency_id, a]))
  const radar = gaps.map((g) => ({ name: g.competency.name.length > 16 ? g.competency.name.slice(0, 15) + '…' : g.competency.name, ระดับที่ต้องการ: g.required, ระดับปัจจุบัน: g.current }))
  const field = isSelf ? 'self_level' : 'manager_level'

  const save = async () => {
    for (const [cid, v] of Object.entries(draft)) {
      const lvl = Number(v)
      const ex = existing[cid]
      const patch = { [field]: lvl, ...(isSelf ? {} : { final_level: lvl }), assessed_at: new Date().toISOString() }
      if (ex) await update('competency_assessments', ex.id, patch)
      else await insert('competency_assessments', { employee_id: emp.id, competency_id: cid, period: String(CURRENT_YEAR), ...patch })
    }
    setDraft({}); notify('บันทึกผลประเมินสมรรถนะแล้ว')
  }

  const filtered = team.filter((e) => !q || `${fullName(e)} ${e.employee_code}`.includes(q)).slice(0, 50)
  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      {isManager && (
        <Card title="เลือกพนักงาน" pad={false}>
          <div className="p-3"><Input placeholder="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-[560px] overflow-y-auto px-2 pb-2">
            {filtered.map((e) => (
              <button key={e.id} onClick={() => { setEmpId(e.id); setDraft({}) }} className={cx('block w-full rounded-lg px-3 py-2 text-left text-sm', e.id === empId ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50')}>
                <div className="font-medium">{fullName(e)}{e.id === me.employee?.id && ' (ฉัน)'}</div><div className="truncate text-xs text-slate-400">{idx.pos[e.position_id]?.name}</div>
              </button>
            ))}
          </div>
        </Card>
      )}
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={`${fullName(emp)} — ${idx.pos[emp.position_id]?.name}`}>
            <div className="h-72">
              <ResponsiveContainer>
                <RadarChart data={radar} outerRadius="70%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                  <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
                  <Radar dataKey="ระดับที่ต้องการ" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} />
                  <Radar dataKey="ระดับปัจจุบัน" stroke="#2f6fe4" fill="#2f6fe4" fillOpacity={0.3} />
                  <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="สรุป Skill Gap">
            {(() => {
              const total = gaps.length; const met = gaps.filter((g) => g.gap === 0).length
              return (
                <div>
                  <div className="mb-4 flex items-end gap-2"><span className="text-4xl font-bold text-navy-900">{total ? Math.round((met / total) * 100) : 0}%</span><span className="pb-1 text-sm text-slate-500">สมรรถนะผ่านเกณฑ์ ({met}/{total})</span></div>
                  {gaps.filter((g) => g.gap > 0).slice(0, 6).map((g) => (
                    <div key={g.competency.id} className="mb-2 flex items-center justify-between text-sm"><span>{g.competency.name}</span><Badge tone={g.gap >= 2 ? 'rose' : 'amber'}>Gap {g.gap}</Badge></div>
                  ))}
                  {gaps.every((g) => g.gap === 0) && <div className="text-sm text-emerald-600">ผ่านเกณฑ์ครบทุกสมรรถนะ</div>}
                </div>
              )
            })()}
          </Card>
        </div>
        <Card title={`แบบประเมินสมรรถนะ ปี ${CURRENT_YEAR + 543} (${isSelf ? 'ประเมินตนเอง' : 'หัวหน้างานประเมิน'})`} action={<Button disabled={!Object.keys(draft).length} onClick={save}><Save size={15} />บันทึกผล</Button>}>
          <Table rows={gaps} columns={[
            { key: 'c', label: 'สมรรถนะ', render: (g) => <div><div className="font-medium">{g.competency.name}</div><div className="text-xs text-slate-400">{g.competency.description}</div></div> },
            { key: 't', label: 'ประเภท', render: (g) => <Badge tone="slate">{LABELS.compType[g.competency.type]}</Badge> },
            { key: 'r', label: 'ระดับที่ต้องการ', render: (g) => <b>{g.required}</b> },
            { key: 's', label: 'ประเมินตนเอง', render: (g) => existing[g.competency.id]?.self_level ?? '-' },
            { key: 'm', label: 'หัวหน้าประเมิน', render: (g) => existing[g.competency.id]?.manager_level ?? '-' },
            { key: 'n', label: isSelf ? 'ระดับ (ตนเอง)' : 'ระดับ (หัวหน้า)', render: (g) => (
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => {
                const cur = Number(draft[g.competency.id] ?? existing[g.competency.id]?.[field] ?? 0)
                return <button key={n} onClick={() => setDraft({ ...draft, [g.competency.id]: n })} className={cx('h-7 w-7 rounded-md text-xs font-semibold ring-1', n <= cur ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-400 ring-slate-200 hover:ring-brand-300')}>{n}</button>
              })}</div>
            ) },
          ]} />
          <p className="mt-3 text-xs text-slate-400">ระดับ 1 = เริ่มต้น · 2 = พื้นฐาน · 3 = ปฏิบัติได้ด้วยตนเอง · 4 = ชำนาญ/สอนผู้อื่นได้ · 5 = ผู้เชี่ยวชาญ/กำหนดแนวทางองค์กร · ผลของหัวหน้างานจะเป็นผลสุดท้าย (final) และเชื่อมโยงกับผลประเมิน KPI จากระบบ Performance</p>
        </Card>
      </div>
    </div>
  )
}

function GapOverview() {
  const { data, idx, visibleEmpIds } = useStore()
  const [bu, setBu] = useState('')
  const res = useMemo(() => {
    const emps = data.employees.filter((e) => visibleEmpIds.has(e.id) && (!bu || e.business_unit_id === bu))
    const byComp = {}; const byDept = {}
    for (const e of emps) {
      const lv = currentLevels(idx, e.id)
      if (!Object.keys(lv).length) continue
      for (const pc of idx.reqByPos[e.position_id] || []) {
        const gap = Math.max(0, pc.required_level - (lv[pc.competency_id] ?? 0))
        const c = (byComp[pc.competency_id] ||= { n: 0, gap: 0, short: 0 })
        c.n++; c.gap += gap; if (gap > 0) c.short++
        const d = ((byDept[e.department_id] ||= {})[pc.competency_id] ||= { n: 0, gap: 0 })
        d.n++; d.gap += gap
      }
    }
    const chart = Object.entries(byComp).map(([cid, v]) => ({ name: idx.comp[cid].name, cid, 'Gap เฉลี่ย': +(v.gap / v.n).toFixed(2), 'ต่ำกว่าเกณฑ์ (%)': Math.round((v.short / v.n) * 100) })).sort((a, b) => b['Gap เฉลี่ย'] - a['Gap เฉลี่ย'])
    return { chart, byDept }
  }, [data, idx, visibleEmpIds, bu])
  const top = res.chart.slice(0, 8).map((x) => x.cid)
  return (
    <div className="space-y-5">
      <div className="w-64"><Select value={bu} onChange={(e) => setBu(e.target.value)}><option value="">ทุกสายธุรกิจ</option>{data.business_units.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
      <Card title="สมรรถนะที่มี Gap สูงสุด (ใช้กำหนดแผนอบรมประจำปี)">
        <div className="h-80"><ResponsiveContainer>
          <BarChart data={res.chart.slice(0, 12)} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid horizontal={false} stroke="#eef2f7" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
            <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="ต่ำกว่าเกณฑ์ (%)" fill="#93b4f5" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer></div>
      </Card>
      <Card title="Heatmap Gap เฉลี่ยรายหน่วยงาน">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><th className="p-2 text-left text-slate-400">หน่วยงาน</th>{top.map((c) => <th key={c} className="p-2 text-left font-medium text-slate-500">{idx.comp[c].name}</th>)}</tr></thead>
            <tbody>{Object.entries(res.byDept).map(([did, m]) => (
              <tr key={did} className="border-t border-slate-50"><td className="whitespace-nowrap p-2 font-medium">{idx.dept[did]?.name}</td>
                {top.map((c) => { const v = m[c] ? m[c].gap / m[c].n : null; return <td key={c} className="p-1"><div className={cx('rounded-md px-2 py-1.5 text-center', v == null ? 'bg-slate-50 text-slate-300' : v >= 1 ? 'bg-rose-200 text-rose-900' : v >= 0.6 ? 'bg-rose-100 text-rose-800' : v >= 0.3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>{v == null ? '–' : v.toFixed(2)}</div></td> })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Dictionary({ editable }) {
  const { data, insert, notify } = useStore()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ code: '', name: '', type: 'functional', description: '' })
  const save = async () => { if (!f.code || !f.name) return; await insert('competencies', f); notify('เพิ่มสมรรถนะแล้ว'); setOpen(false) }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {['core', 'managerial', 'functional', 'technical'].map((t) => (
        <Card key={t} title={`${LABELS.compType[t]} Competency`} action={editable && t === 'core' && <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} />เพิ่มสมรรถนะ</Button>}>
          {data.competencies.filter((c) => c.type === t).map((c) => (
            <div key={c.id} className="border-b border-slate-50 py-2 last:border-0"><div className="text-sm font-medium">{c.name} <span className="text-xs text-slate-400">{c.code}</span></div><div className="text-xs text-slate-500">{c.description}</div></div>
          ))}
        </Card>
      ))}
      <Modal open={open} onClose={() => setOpen(false)} title="เพิ่มสมรรถนะ" footer={<Button onClick={save}>บันทึก</Button>}>
        <div className="space-y-3">
          <Field label="รหัส"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
          <Field label="ชื่อสมรรถนะ"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="ประเภท"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={Object.entries(LABELS.compType).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="คำอธิบาย"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}

function Matrix({ editable }) {
  const { data, idx, update, insert, remove, notify } = useStore()
  const [track, setTrack] = useState('store')
  const positions = data.positions.filter((p) => p.career_track === track).sort((a, b) => a.job_level - b.job_level)
  const comps = data.competencies.filter((c) => data.position_competencies.some((pc) => positions.some((p) => p.id === pc.position_id) && pc.competency_id === c.id))
  const cell = (p, c) => data.position_competencies.find((pc) => pc.position_id === p.id && pc.competency_id === c.id)
  const change = async (p, c, v) => {
    const ex = cell(p, c)
    if (!v && ex) await remove('position_competencies', ex.id)
    else if (ex) await update('position_competencies', ex.id, { required_level: Number(v) })
    else if (v) await insert('position_competencies', { position_id: p.id, competency_id: c.id, required_level: Number(v) })
    notify('อัปเดตระดับสมรรถนะที่ต้องการแล้ว')
  }
  return (
    <Card>
      <div className="mb-4 w-72"><Select value={track} onChange={(e) => setTrack(e.target.value)} options={Object.entries(LABELS.track).map(([value, label]) => ({ value, label }))} /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400"><th className="p-2">สมรรถนะ</th>{positions.map((p) => <th key={p.id} className="p-2 font-medium text-slate-600">{p.name}<div className="font-normal text-slate-400">Level {p.job_level}</div></th>)}</tr></thead>
          <tbody>{comps.map((c) => (
            <tr key={c.id} className="border-t border-slate-50">
              <td className="p-2"><div className="font-medium">{c.name}</div><div className="text-xs text-slate-400">{LABELS.compType[c.type]}</div></td>
              {positions.map((p) => {
                const v = cell(p, c)?.required_level
                return <td key={p.id} className="p-2">{editable
                  ? <select value={v || ''} onChange={(e) => change(p, c, e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm"><option value="">–</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
                  : <span className={cx('inline-grid h-7 w-7 place-items-center rounded-md text-xs font-bold', v ? 'bg-brand-50 text-brand-700' : 'text-slate-300')}>{v || '–'}</span>}</td>
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-slate-400">{idx && 'ระดับที่ต้องการของแต่ละตำแหน่ง ใช้คำนวณ Skill Gap, หลักสูตรแนะนำ และความพร้อมเลื่อนตำแหน่ง'}</div>
    </Card>
  )
}
