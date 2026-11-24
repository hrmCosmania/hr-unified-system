import { Clock, Plus, Search, Star, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Field, Input, inputCls, Modal, PageHeader, Select } from '../components/ui'
import { fmtNum, LABELS } from '../lib/format'
import { useStore } from '../lib/store'
import { CourseThumb } from './Dashboard'

const CATS = ['Leadership', 'Functional', 'Soft Skill', 'Safety', 'Compliance', 'Digital']

export default function Courses() {
  const { data, idx, isHR } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [fmt, setFmt] = useState('')
  const [lvl, setLvl] = useState('')
  const [bu, setBu] = useState('')
  const [adding, setAdding] = useState(false)

  const stats = useMemo(() => Object.fromEntries(data.courses.map((c) => {
    const ens = (idx.sessionsByCourse[c.id] || []).flatMap((s) => idx.enrollBySession[s.id] || [])
    const sat = ens.filter((e) => e.satisfaction != null)
    return [c.id, { n: ens.length, rating: sat.length ? sat.reduce((a, e) => a + Number(e.satisfaction), 0) / sat.length : null, reviews: sat.length, open: (idx.sessionsByCourse[c.id] || []).filter((s) => s.status === 'open').length }]
  })), [data, idx])

  const list = data.courses.filter((c) => (isHR || c.status === 'published')
    && (!q || `${c.title} ${c.code} ${c.description}`.toLowerCase().includes(q.toLowerCase()))
    && (!cat || c.category === cat) && (!fmt || c.format === fmt) && (!lvl || c.level === lvl)
    && (!bu || !c.target_bu?.length || c.target_bu.includes(bu)))

  return (
    <div>
      <PageHeader title="หลักสูตรอบรม" subtitle="Course Catalog — หลักสูตรสำหรับทุกสายงาน Retail / FMCG / Factory"
        crumbs={[{ label: 'HRD', to: '/' }, { label: 'หลักสูตรอบรม' }]}
        actions={isHR && <Button onClick={() => setAdding(true)}><Plus size={16} />เพิ่มหลักสูตร</Button>} />

      <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาหลักสูตร, หัวข้อ, รหัส…" className={inputCls + ' pl-9'} /></div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">ทุกหมวดหมู่</option>{CATS.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={fmt} onChange={(e) => setFmt(e.target.value)}><option value="">ทุกรูปแบบ</option>{Object.entries(LABELS.format).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">ทุกระดับ</option>{Object.entries(LABELS.level).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={bu} onChange={(e) => setBu(e.target.value)}><option value="">ทุกสายธุรกิจ</option><option value="RETAIL">Retail</option><option value="FMCG">FMCG</option><option value="FACTORY">Factory</option></Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((c) => {
          const s = stats[c.id]
          return (
            <button key={c.id} onClick={() => nav(`/courses/${c.id}`)} className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative flex h-28 items-end bg-gradient-to-br from-slate-50 to-brand-50 p-4">
                <CourseThumb course={c} size={56} />
                <div className="absolute right-3 top-3 flex gap-1">
                  {c.is_mandatory && <Badge tone="rose">ภาคบังคับ</Badge>}
                  {c.status !== 'published' && <Badge tone="slate">{c.status}</Badge>}
                  {s.open > 0 && <Badge tone="blue">เปิดรับ {s.open} รุ่น</Badge>}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="text-xs text-slate-400">{c.code}</div>
                <div className="font-semibold leading-snug text-navy-900 group-hover:text-brand-700">{c.title}</div>
                <div className="mt-2 flex flex-wrap gap-1"><Badge tone="blue">{c.category}</Badge><Badge tone="slate">{LABELS.level[c.level]}</Badge></div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{LABELS.format[c.format]}</span>
                  <span className="flex items-center gap-1"><Clock size={13} />{c.hours} ชม.</span>
                  <span className="flex items-center gap-1"><Users size={13} />{fmtNum(s.n)}</span>
                </div>
                <div className="mt-auto pt-3 text-sm">
                  {s.rating ? <span className="flex items-center gap-1"><Star size={15} className="fill-amber-400 text-amber-400" /><b>{s.rating.toFixed(1)}</b><span className="text-xs text-slate-400">({fmtNum(s.reviews)})</span></span> : <span className="text-xs text-slate-400">ยังไม่มีคะแนน</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {!list.length && <div className="py-16 text-center text-slate-400">ไม่พบหลักสูตรตามเงื่อนไข</div>}
      <CourseForm open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

export function CourseForm({ open, onClose, course }) {
  const { insert, update, notify, data } = useStore()
  const nav = useNavigate()
  const [f, setF] = useState(() => course || { code: '', title: '', category: 'Functional', format: 'classroom', level: 'basic', hours: 6, description: '', is_mandatory: false, target_bu: [], pass_score: 70, validity_months: '', status: 'published', comps: [] })
  const [comps, setComps] = useState(() => (course ? data.course_competencies.filter((c) => c.course_id === course.id).map((c) => c.competency_id) : []))
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const save = async () => {
    if (!f.code || !f.title) return notify('กรุณากรอกรหัสและชื่อหลักสูตร', 'error')
    const { comps: _c, ...row } = f // eslint-disable-line no-unused-vars
    const payload = { ...row, hours: Number(f.hours), pass_score: Number(f.pass_score), validity_months: f.validity_months ? Number(f.validity_months) : null }
    if (course) {
      await update('courses', course.id, payload)
      notify('บันทึกหลักสูตรแล้ว')
    } else {
      const [saved] = await insert('courses', { ...payload, objectives: [] })
      if (comps.length) await insert('course_competencies', comps.map((cid) => ({ course_id: saved.id, competency_id: cid })))
      notify('เพิ่มหลักสูตรแล้ว')
      nav(`/courses/${saved.id}`)
    }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={course ? 'แก้ไขหลักสูตร' : 'เพิ่มหลักสูตรใหม่'} wide footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึก</Button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="รหัสหลักสูตร"><Input value={f.code} onChange={set('code')} placeholder="เช่น LD-203" /></Field>
        <Field label="ชื่อหลักสูตร"><Input value={f.title} onChange={set('title')} /></Field>
        <Field label="หมวดหมู่"><Select value={f.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="รูปแบบ"><Select value={f.format} onChange={set('format')} options={Object.entries(LABELS.format).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="ระดับ"><Select value={f.level} onChange={set('level')} options={Object.entries(LABELS.level).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="จำนวนชั่วโมง"><Input type="number" value={f.hours} onChange={set('hours')} /></Field>
        <Field label="เกณฑ์ผ่าน (คะแนน)"><Input type="number" value={f.pass_score} onChange={set('pass_score')} /></Field>
        <Field label="อายุใบรับรอง (เดือน)" hint="เว้นว่างหากไม่มีวันหมดอายุ"><Input type="number" value={f.validity_months ?? ''} onChange={set('validity_months')} /></Field>
        <Field label="สายธุรกิจเป้าหมาย" hint="ไม่เลือก = ทุกสายงาน">
          <div className="flex gap-3 pt-1 text-sm">{['RETAIL', 'FMCG', 'FACTORY'].map((b) => (
            <label key={b} className="flex items-center gap-1.5"><input type="checkbox" checked={f.target_bu?.includes(b)} onChange={(e) => setF({ ...f, target_bu: e.target.checked ? [...(f.target_bu || []), b] : f.target_bu.filter((x) => x !== b) })} />{b}</label>
          ))}</div>
        </Field>
        <Field label="สถานะ"><Select value={f.status} onChange={set('status')} options={[{ value: 'draft', label: 'ร่าง' }, { value: 'published', label: 'เผยแพร่' }, { value: 'archived', label: 'เก็บถาวร' }]} /></Field>
        <div className="md:col-span-2"><Field label="รายละเอียด"><textarea rows={3} className={inputCls} value={f.description || ''} onChange={set('description')} /></Field></div>
        {!course && (
          <div className="md:col-span-2"><Field label="สมรรถนะที่พัฒนา (ใช้สำหรับแนะนำหลักสูตรจาก Skill Gap)">
            <div className="flex flex-wrap gap-2 pt-1">{data.competencies.map((c) => (
              <button type="button" key={c.id} onClick={() => setComps(comps.includes(c.id) ? comps.filter((x) => x !== c.id) : [...comps, c.id])}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${comps.includes(c.id) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200'}`}>{c.name}</button>
            ))}</div>
          </Field></div>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_mandatory} onChange={set('is_mandatory')} />หลักสูตรภาคบังคับ (Mandatory)</label>
      </div>
    </Modal>
  )
}
