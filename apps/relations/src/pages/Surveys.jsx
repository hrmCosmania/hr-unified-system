import { useState } from 'react'
import { Lock, Plus, Trash2, ChevronUp, ChevronDown, Copy, RotateCcw } from 'lucide-react'
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list, rpc, update } from '../lib/api'
import { Badge, Bar, Field, Icon, Modal, PageHead, Ring, Stat, thDate, daysUntil, Empty } from '../components/ui'

const TYPE = { engagement: 'Engagement ประจำปี', pulse: 'Pulse Survey', enps: 'eNPS', onboarding: 'Onboarding', exit: 'Exit', event: 'หลังกิจกรรม' }
const LIKERT = ['ไม่เห็นด้วยอย่างยิ่ง', 'ไม่เห็นด้วย', 'เฉยๆ', 'เห็นด้วย', 'เห็นด้วยอย่างยิ่ง']

export default function Surveys() {
  const app = useApp()
  const [take, setTake] = useState(null)
  const [results, setResults] = useState(null)
  const [builder, setBuilder] = useState(null)
  const [reopen, setReopen] = useState(null)
  const [d, reload] = useLoad(async () => {
    const [surveys, qs, part] = await Promise.all([list('er_surveys', { order: 'created_at' }), list('er_survey_questions'), list('er_survey_participation', { eq: { employee_id: app.me.id } })])
    return { surveys, qs, part }
  }, [app.me.id])

  const visible = (d?.surveys || []).filter((s) => app.isHR || s.status !== 'draft')
  const answered = (id) => d?.part.some((p) => p.survey_id === id)

  async function showResults(s) {
    const r = await rpc('er_survey_results', { p_survey: s.id })
    setResults({ s, r })
  }
  async function setStatus(s, status) {
    await update('er_surveys', { id: s.id }, { status, ...(status === 'open' ? { open_at: new Date().toISOString() } : { close_at: new Date().toISOString() }) })
    app.toast(status === 'open' ? 'เปิดแบบสำรวจแล้ว' : 'ปิดแบบสำรวจแล้ว'); reload()
  }
  // เปิดแบบสำรวจที่ปิดไปแล้วอีกครั้ง: คงวันเปิดเดิม + คำตอบเดิมไว้ และกำหนดวันปิดใหม่
  async function reopenSurvey(e) {
    e.preventDefault()
    await update('er_surveys', { id: reopen.s.id }, { status: 'open', close_at: new Date(`${reopen.close}T23:59:59`).toISOString() })
    app.toast(`เปิด "${reopen.s.title}" อีกครั้งแล้ว ถึง ${thDate(reopen.close)}`); setReopen(null); reload()
  }

  return (
    <div>
      <PageHead eyebrow="ความผูกพันพนักงาน" title="แบบสำรวจความผูกพัน & Pulse" sub="รับฟังเสียงพนักงานอย่างสม่ำเสมอ · ไม่ระบุตัวตน · แสดงผลเฉพาะกลุ่มที่มีผู้ตอบ ≥ 5 คน">
        {app.isHR && <button className="btn btn-primary" onClick={() => setBuilder({ step: 'pick' })}><Plus size={16} /> สร้างแบบสำรวจ</button>}
      </PageHead>

      <div className="demo-banner mb16" style={{ background: 'var(--violet-50)', borderColor: '#ddd6fe', color: '#5b21b6' }}>
        <Lock size={16} /> <span><b>ความเป็นส่วนตัว:</b> ระบบแยก "ใครตอบแล้ว" ออกจาก "คำตอบ" — HR ไม่สามารถเห็นคำตอบรายบุคคลของแบบสำรวจนิรนามได้ (บังคับที่ระดับฐานข้อมูล)</span>
      </div>

      <div className="grid g3">
        {visible.map((s) => {
          const qn = d.qs.filter((q) => q.survey_id === s.id).length
          const done = answered(s.id)
          const left = s.close_at ? daysUntil(s.close_at) : null
          return (
            <div key={s.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="row between">
                <Badge tone={s.status === 'open' ? 'green' : s.status === 'draft' ? 'gray' : 'violet'}>{{ open: 'เปิดรับคำตอบ', draft: 'ฉบับร่าง', closed: 'ปิดแล้ว' }[s.status]}</Badge>
                <span className="tiny faint">{TYPE[s.survey_type]}</span>
              </div>
              <div className="bold mt12" style={{ fontSize: 16 }}>{s.title}</div>
              <p className="small muted mt8">{s.description}</p>
              <div className="small faint mt12">{qn} คำถาม · {s.is_anonymous ? 'ไม่ระบุตัวตน' : 'ระบุตัวตน'}{left != null && s.status === 'open' ? ` · เหลือ ${left} วัน` : ''}</div>
              <div className="row wrap mt16" style={{ marginTop: 'auto', paddingTop: 16 }}>
                {s.status === 'open' && (done ? <Badge tone="green" icon="CheckCircle2">คุณตอบแล้ว ขอบคุณ!</Badge> : <button className="btn btn-pink btn-sm" onClick={() => setTake(s)}>ตอบแบบสำรวจ</button>)}
                {app.isHR && s.status !== 'draft' && <button className="btn btn-ghost btn-sm" onClick={() => showResults(s)}><Icon name="BarChart3" size={14} /> ดูผล</button>}
                {app.isHR && s.status === 'draft' && <button className="btn btn-primary btn-sm" onClick={() => setStatus(s, 'open')}>เปิดแบบสำรวจ</button>}
                {app.isHR && s.status === 'open' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(s, 'closed')}>ปิดรับ</button>}
                {app.isHR && s.status === 'closed' && <button className="btn btn-soft btn-sm" onClick={() => setReopen({ s, close: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })}><RotateCcw size={14} /> เปิดอีกครั้ง</button>}
                {app.isHR && <button className="btn btn-ghost btn-sm" title="ทำสำเนาเป็นแบบสำรวจใหม่" onClick={() => setBuilder(draftFrom(s, d.qs.filter((q) => q.survey_id === s.id).sort((a, b) => a.seq - b.seq)))}><Copy size={14} /> ใช้เป็น Template</button>}
              </div>
            </div>
          )
        })}
      </div>
      {visible.length === 0 && <Empty text="ยังไม่มีแบบสำรวจที่เปิดอยู่" />}

      {take && <TakeSurvey survey={take} questions={d.qs.filter((q) => q.survey_id === take.id).sort((a, b) => a.seq - b.seq)} onClose={() => setTake(null)} onDone={() => { setTake(null); app.toast('ส่งคำตอบแล้ว ขอบคุณที่ช่วยให้องค์กรดีขึ้น 💙'); reload() }} />}
      {results && <Results data={results} onClose={() => setResults(null)} />}
      <Modal open={!!reopen} onClose={() => setReopen(null)} title="เปิดแบบสำรวจอีกครั้ง" sub={reopen?.s.title}>
        {reopen && (
          <form onSubmit={reopenSurvey}>
            <div className="small mb16" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12, lineHeight: 1.8 }}>
              • คำตอบเดิม <b>ยังเก็บไว้ครบ</b> และนับรวมกับคำตอบใหม่ในผลสำรวจเดียวกัน<br />
              • คนที่ตอบแล้วจะไม่สามารถตอบซ้ำได้ — เหมาะสำหรับขยายเวลาให้คนที่ยังไม่ได้ตอบ<br />
              • ถ้าต้องการวัดผลรอบใหม่ ให้ใช้ปุ่ม <b>ใช้เป็น Template</b> แทน
            </div>
            <Field label="ปิดรับคำตอบวันที่"><input className="input" type="date" required min={new Date().toISOString().slice(0, 10)} value={reopen.close} onChange={(e) => setReopen({ ...reopen, close: e.target.value })} /></Field>
            <button className="btn btn-primary btn-block"><RotateCcw size={15} /> เปิดรับคำตอบอีกครั้ง</button>
          </form>
        )}
      </Modal>
      {builder && <Builder value={builder} setValue={setBuilder} surveys={d?.surveys || []} qs={d?.qs || []} onSaved={() => { setBuilder(null); app.toast('บันทึกแบบสำรวจ (ฉบับร่าง) แล้ว'); reload() }} />}
    </div>
  )
}

function TakeSurvey({ survey, questions, onClose, onDone }) {
  const [ans, setAns] = useState({})
  const [err, setErr] = useState(null)
  const required = questions.filter((q) => q.q_type !== 'text')
  const progress = Math.round((100 * required.filter((q) => ans[q.id] != null).length) / Math.max(1, required.length))
  async function submit() {
    if (progress < 100) return setErr('กรุณาตอบคำถามให้ครบ')
    try {
      await rpc('er_submit_survey', { p_survey: survey.id, p_answers: questions.map((q) => ({ question_id: q.id, score: q.q_type === 'text' ? null : ans[q.id], text: q.q_type === 'text' ? ans[q.id] || null : null })) })
      onDone()
    } catch (e) { setErr(e.message) }
  }
  return (
    <Modal open onClose={onClose} title={survey.title} sub={survey.description} wide>
      <div className="row mb16" style={{ gap: 10 }}><div style={{ flex: 1 }}><Bar value={progress} color="var(--pink)" /></div><span className="small bold">{progress}%</span></div>
      {questions.map((q, i) => (
        <div key={q.id} className="card card-pad mb16" style={{ padding: 16 }}>
          <div className="row between"><div className="bold small">{i + 1}. {q.text}</div>{q.dimension && <Badge tone="gray">{q.dimension}</Badge>}</div>
          <div className="mt12">
            {q.q_type === 'likert' && <div className="likert">{LIKERT.map((l, k) => <button key={k} title={l} className={ans[q.id] === k + 1 ? 'on' : ''} onClick={() => setAns((a) => ({ ...a, [q.id]: k + 1 }))}>{k + 1}<div className="tiny" style={{ fontWeight: 400 }}>{k === 0 || k === 4 ? l : ''}</div></button>)}</div>}
            {q.q_type === 'nps' && <div className="likert nps">{Array.from({ length: 11 }, (_, k) => <button key={k} className={ans[q.id] === k ? 'on' : ''} onClick={() => setAns((a) => ({ ...a, [q.id]: k }))}>{k}</button>)}</div>}
            {q.q_type === 'text' && <textarea className="textarea" placeholder="(ไม่บังคับ)" value={ans[q.id] || ''} onChange={(e) => setAns((a) => ({ ...a, [q.id]: e.target.value }))} />}
          </div>
        </div>
      ))}
      {err && <p className="small mb16" style={{ color: 'var(--red)' }}>{err}</p>}
      <button className="btn btn-pink btn-block" onClick={submit}>ส่งคำตอบ (ไม่ระบุตัวตน)</button>
    </Modal>
  )
}

function Results({ data: { s, r }, onClose }) {
  const lik = r.questions.filter((q) => q.q_type === 'likert')
  const nps = r.questions.find((q) => q.q_type === 'nps')
  const eng = lik.length ? Math.round(lik.reduce((a, q) => a + (q.favorable || 0), 0) / lik.length) : 0
  const rate = Math.round((100 * r.responses) / Math.max(1, r.invited))
  const colors = (v) => (v >= 75 ? '#10B981' : v >= 60 ? '#3B5BFD' : v >= 45 ? '#F59E0B' : '#EF4444')
  return (
    <Modal open onClose={onClose} title={`ผลแบบสำรวจ · ${s.title}`} sub={`ปิดรับ ${thDate(s.close_at)} · แสดงเฉพาะข้อมูลรวม`} wide>
      <div className="grid g3" style={{ gap: 12 }}>
        <div className="card card-pad row" style={{ gap: 14 }}><Ring value={eng} size={84} stroke={9} /><div><div className="small bold">Engagement</div><div className="tiny faint">% ตอบเห็นด้วย (4-5)</div></div></div>
        <Stat label="อัตราการตอบ" value={rate} unit="%" foot={`${r.responses}/${r.invited} คน`} icon="UserCheck" />
        <Stat label="eNPS" value={nps?.enps ?? '-'} icon="Megaphone" tone={nps?.enps >= 20 ? 'green' : 'amber'} foot="ช่วง -100 ถึง +100" />
      </div>
      <h4 className="mt24 mb8">ผลรายมิติ</h4>
      {lik.map((q) => (
        <div key={q.id} className="mb16">
          <div className="row between small"><span><b>{q.dimension}</b> · {q.text}</span><span className="bold">{q.favorable}%</span></div>
          <div className="mt8"><Bar value={q.favorable} color={colors(q.favorable)} /></div>
        </div>
      ))}
      <h4 className="mt24 mb8">แยกตามหน่วยงาน (≥ {s.min_group_size} คน)</h4>
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={r.by_department} layout="vertical" margin={{ left: 30, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => v + '%'} />
            <RBar dataKey="favorable" radius={[0, 6, 6, 0]} barSize={16}>{r.by_department.map((x, i) => <Cell key={i} fill={colors(x.favorable)} />)}</RBar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <h4 className="mt24 mb8">ความคิดเห็น ({r.comments.length})</h4>
      <div className="grid g2" style={{ gap: 8 }}>{r.comments.slice(0, 10).map((c, i) => <div key={i} className="small" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>“{c}”</div>)}</div>
    </Modal>
  )
}

// Template มาตรฐาน (ใช้ได้ทันทีแม้ยังไม่เคยสร้างแบบสำรวจ)
const L = (text, dimension) => ({ text, q_type: 'likert', dimension })
const NPS = { text: 'คุณจะแนะนำบริษัทนี้ให้เพื่อนมาทำงานมากแค่ไหน (0-10)', q_type: 'nps', dimension: 'eNPS' }
const T = (text) => ({ text, q_type: 'text', dimension: '' })
export const STD_TEMPLATES = [
  { key: 'pulse', icon: 'Activity', title: 'Pulse Survey รายไตรมาส', description: 'ใช้เวลา 3 นาที · ไม่ระบุตัวตน', survey_type: 'pulse', questions: [
    L('ฉันภูมิใจที่ได้บอกคนอื่นว่าทำงานที่นี่', 'Pride'), L('หัวหน้าของฉันใส่ใจความเป็นอยู่ของฉัน', 'Leadership'), L('ฉันได้รับการชื่นชมเมื่อทำงานได้ดี', 'Recognition'),
    L('ฉันเห็นโอกาสเติบโตในองค์กรนี้', 'Growth'), L('ฉันสามารถรักษาสมดุลชีวิตและงานได้', 'Wellbeing'), L('ค่านิยมองค์กรสะท้อนในการทำงานจริงทุกวัน', 'Culture'),
    NPS, T('สิ่งหนึ่งที่อยากให้องค์กรเปลี่ยนแปลงคืออะไร')] },
  { key: 'engagement', icon: 'HeartPulse', title: 'Engagement Survey ประจำปี', description: 'แบบสำรวจความผูกพันฉบับเต็ม', survey_type: 'engagement', questions: [
    L('ฉันรู้ชัดเจนว่าองค์กรคาดหวังอะไรจากงานของฉัน', 'Clarity'), L('ฉันมีเครื่องมือและทรัพยากรเพียงพอในการทำงาน', 'Enablement'), L('ฉันได้ใช้จุดแข็งของตัวเองทุกวัน', 'Strengths'),
    L('ในช่วง 7 วันที่ผ่านมา ฉันได้รับคำชื่นชมจากการทำงาน', 'Recognition'), L('หัวหน้าใส่ใจฉันในฐานะคนคนหนึ่ง', 'Leadership'), L('มีคนในองค์กรที่สนับสนุนการพัฒนาของฉัน', 'Growth'),
    L('ความคิดเห็นของฉันได้รับการรับฟัง', 'Voice'), L('ภารกิจขององค์กรทำให้ฉันรู้สึกว่างานของฉันสำคัญ', 'Purpose'), L('เพื่อนร่วมงานมุ่งมั่นทำงานให้มีคุณภาพ', 'Teamwork'),
    L('ฉันรู้สึกเป็นส่วนหนึ่งของทีม', 'Belonging'), L('ในปีที่ผ่านมา ฉันได้เรียนรู้และเติบโต', 'Growth'), L('ฉันตั้งใจจะทำงานที่นี่ต่อไปอีกอย่างน้อย 2 ปี', 'Retention'),
    NPS, T('อะไรคือสิ่งที่ทำให้คุณอยากอยู่กับองค์กรนี้'), T('ถ้าเปลี่ยนได้ 1 อย่าง คุณอยากเปลี่ยนอะไร')] },
  { key: 'onboarding', icon: 'DoorOpen', title: 'Onboarding Experience (60 วัน)', description: 'สำหรับพนักงานใหม่ครบ 60 วัน', survey_type: 'onboarding', questions: [
    L('ฉันได้รับข้อมูลที่จำเป็นตั้งแต่วันแรก', 'Day 1'), L('อุปกรณ์และสิทธิ์ใช้งานพร้อมเมื่อฉันเริ่มงาน', 'Readiness'), L('Buddy/พี่เลี้ยงช่วยให้ฉันปรับตัวได้เร็ว', 'Buddy'),
    L('หัวหน้าตั้งเป้าหมายช่วงทดลองงานกับฉันชัดเจน', 'Leadership'), L('ฉันเข้าใจวัฒนธรรมและค่านิยมขององค์กร', 'Culture'), L('งานจริงตรงกับที่ได้รับแจ้งตอนสัมภาษณ์', 'Expectation'),
    NPS, T('อะไรที่จะทำให้ช่วงเริ่มงานดีขึ้นสำหรับคนต่อไป')] },
  { key: 'exit', icon: 'Plane', title: 'Exit Survey', description: 'รับฟังเหตุผลการลาออกเพื่อปรับปรุงองค์กร', survey_type: 'exit', questions: [
    L('ฉันได้รับโอกาสเติบโตในหน้าที่การงานอย่างเหมาะสม', 'Growth'), L('ค่าตอบแทนและสวัสดิการเป็นธรรม', 'Reward'), L('หัวหน้าสนับสนุนและให้ feedback ที่ดี', 'Leadership'),
    L('ภาระงานเหมาะสมและรักษาสมดุลชีวิตได้', 'Wellbeing'), L('ฉันรู้สึกเป็นส่วนหนึ่งของทีม', 'Belonging'),
    NPS, T('เหตุผลหลักที่ตัดสินใจลาออก'), T('มีอะไรที่ถ้าองค์กรทำ คุณจะตัดสินใจอยู่ต่อ')] },
  { key: 'event', icon: 'CalendarHeart', title: 'ประเมินหลังกิจกรรม', description: 'วัดความพึงพอใจหลังจบกิจกรรม/แคมเปญ', survey_type: 'event', questions: [
    L('กิจกรรมนี้มีประโยชน์และน่าสนใจ', 'Value'), L('การจัดการและการสื่อสารก่อนกิจกรรมดี', 'Organization'), L('กิจกรรมช่วยให้ฉันรู้สึกใกล้ชิดเพื่อนร่วมงานมากขึ้น', 'Belonging'),
    T('อยากให้จัดกิจกรรมแบบไหนอีก')] }
]

const cleanQ = (q) => ({ text: q.text, q_type: q.q_type, dimension: q.dimension || '' })
// สร้างฉบับร่างจากแบบสำรวจเดิมหรือ template — คัดลอกเฉพาะคำถาม/การตั้งค่า ไม่คัดลอกคำตอบ
export function draftFrom(src, questions, copy = true) {
  return {
    title: copy ? `${src.title} (สำเนา)` : src.title, description: src.description || '', survey_type: src.survey_type,
    is_anonymous: src.is_anonymous ?? true, questions: questions.map(cleanQ), templateName: src.title, step: 'edit'
  }
}

function TemplatePicker({ surveys, qs, onPick }) {
  const qOf = (id) => qs.filter((q) => q.survey_id === id).sort((a, b) => a.seq - b.seq)
  const Item = ({ icon, title, sub, tone = 'blue', onClick }) => (
    <button type="button" className="card qa" style={{ textAlign: 'left', padding: 14 }} onClick={onClick}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className={`ico b-${tone}`} style={{ margin: 0, width: 38, height: 38, borderRadius: 12 }}><Icon name={icon} size={18} /></div>
        <div style={{ minWidth: 0 }}><div className="bold small">{title}</div><div className="tiny faint">{sub}</div></div>
      </div>
    </button>
  )
  return (
    <div>
      <div className="grid g3" style={{ gap: 10 }}>
        <Item icon="FilePlus2" tone="gray" title="เริ่มจากศูนย์" sub="แบบสำรวจเปล่า"
          onClick={() => onPick({ title: '', description: '', survey_type: 'pulse', is_anonymous: true, questions: [{ text: '', q_type: 'likert', dimension: '' }], step: 'edit' })} />
      </div>
      <div className="small bold mt24 mb8">Template มาตรฐาน</div>
      <div className="grid g3" style={{ gap: 10 }}>
        {STD_TEMPLATES.map((t) => <Item key={t.key} icon={t.icon} title={t.title} sub={`${t.questions.length} คำถาม · ${TYPE[t.survey_type]}`} onClick={() => onPick(draftFrom(t, t.questions, false))} />)}
      </div>
      {surveys.length > 0 && <>
        <div className="small bold mt24 mb8">ใช้แบบสำรวจเดิมขององค์กรเป็น Template</div>
        <div className="grid g3" style={{ gap: 10 }}>
          {surveys.map((s) => (
            <Item key={s.id} icon="Copy" tone="violet" title={s.title}
              sub={`${qOf(s.id).length} คำถาม · ${{ open: 'เปิดอยู่', draft: 'ฉบับร่าง', closed: 'ปิดแล้ว' }[s.status]}${s.open_at ? ' · ' + thDate(s.open_at) : ''}`}
              onClick={() => onPick(draftFrom(s, qOf(s.id)))} />
          ))}
        </div>
        <p className="tiny faint mt12">คัดลอกเฉพาะคำถามและการตั้งค่า — คำตอบเดิมไม่ถูกคัดลอก และแก้ไขได้โดยไม่กระทบแบบสำรวจต้นฉบับ</p>
      </>}
    </div>
  )
}

function Builder({ value: f, setValue, onSaved, surveys, qs }) {
  const setQ = (i, patch) => setValue({ ...f, questions: f.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) })
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= f.questions.length) return
    const arr = [...f.questions]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setValue({ ...f, questions: arr })
  }
  async function save(e) {
    e.preventDefault()
    const { questions, step, templateName, ...s } = f
    const sv = await insert('er_surveys', { ...s, status: 'draft', min_group_size: 5 })
    for (let i = 0; i < questions.length; i++) await insert('er_survey_questions', { survey_id: sv.id, seq: i + 1, ...questions[i], dimension: questions[i].dimension || null })
    onSaved()
  }
  if (f.step !== 'edit') {
    return (
      <Modal open onClose={() => setValue(null)} title="สร้างแบบสำรวจ" sub="เลือก Template เพื่อเริ่มต้น แล้วปรับแก้คำถามได้ตามต้องการ" wide>
        <TemplatePicker surveys={surveys} qs={qs} onPick={setValue} />
      </Modal>
    )
  }
  return (
    <Modal open onClose={() => setValue(null)} title="สร้างแบบสำรวจ" wide>
      <form onSubmit={save}>
        <div className="row between mb16" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '8px 12px' }}>
          <span className="small row" style={{ gap: 6 }}><Icon name="LayoutTemplate" size={14} /> {f.templateName ? <span>Template: <b>{f.templateName}</b></span> : 'เริ่มจากศูนย์'}</span>
          <button type="button" className="card-link" onClick={() => setValue({ ...f, step: 'pick' })}>เปลี่ยน Template</button>
        </div>
        <div className="grid g2" style={{ gap: 12 }}>
          <Field label="ชื่อแบบสำรวจ"><input className="input" required value={f.title} onChange={(e) => setValue({ ...f, title: e.target.value })} /></Field>
          <Field label="ประเภท"><select className="select" value={f.survey_type} onChange={(e) => setValue({ ...f, survey_type: e.target.value })}>{Object.entries(TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <Field label="คำอธิบาย"><input className="input" value={f.description} onChange={(e) => setValue({ ...f, description: e.target.value })} /></Field>
        <label className="check mb16"><input type="checkbox" checked={f.is_anonymous} onChange={(e) => setValue({ ...f, is_anonymous: e.target.checked })} /> ไม่ระบุตัวตน (แนะนำ)</label>
        <div className="small bold mb8">คำถาม ({f.questions.length})</div>
        {f.questions.map((q, i) => (
          <div key={i} className="row mb8" style={{ gap: 6 }}>
            <span className="small bold" style={{ width: 20 }}>{i + 1}</span>
            <input className="input" placeholder="คำถาม" required value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
            <select className="select" style={{ width: 120, flexShrink: 0 }} value={q.q_type} onChange={(e) => setQ(i, { q_type: e.target.value })}><option value="likert">Likert 1-5</option><option value="nps">NPS 0-10</option><option value="text">ข้อความ</option></select>
            <input className="input" style={{ width: 110, flexShrink: 0 }} placeholder="มิติ" value={q.dimension} onChange={(e) => setQ(i, { dimension: e.target.value })} />
            <button type="button" className="icon-btn" style={{ width: 32, height: 32, flexShrink: 0 }} title="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={15} /></button>
            <button type="button" className="icon-btn" style={{ width: 32, height: 32, flexShrink: 0 }} title="เลื่อนลง" disabled={i === f.questions.length - 1} onClick={() => move(i, 1)}><ChevronDown size={15} /></button>
            <button type="button" className="icon-btn" style={{ width: 32, height: 32, flexShrink: 0 }} title="ลบ" onClick={() => setValue({ ...f, questions: f.questions.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm mb16" onClick={() => setValue({ ...f, questions: [...f.questions, { text: '', q_type: 'likert', dimension: '' }] })}><Plus size={14} /> เพิ่มคำถาม</button>
        <button className="btn btn-primary btn-block" disabled={f.questions.length === 0}>บันทึกฉบับร่าง</button>
      </form>
    </Modal>
  )
}
