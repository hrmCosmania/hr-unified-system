import { useState } from 'react'
import { Send, Search, ShieldAlert } from 'lucide-react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list, rpc, update } from '../lib/api'
import { Badge, Cover, Field, Icon, Modal, PageHead, Stat, Tabs, ago, fullName, Empty } from '../components/ui'

export const FB_TYPE = { suggestion: ['ข้อเสนอแนะ', 'blue', 'MessageSquarePlus'], idea: ['ไอเดีย', 'amber', 'Lightbulb'], question: ['คำถาม', 'teal', 'HelpCircle'], concern: ['ข้อกังวล', 'red', 'AlertTriangle'], praise: ['คำชม', 'pink', 'Heart'] }
export const FB_STATUS = { new: ['ใหม่', 'blue'], in_review: ['กำลังพิจารณา', 'amber'], answered: ['ตอบแล้ว', 'green'], implemented: ['นำไปปฏิบัติแล้ว', 'violet'], closed: ['ปิด', 'gray'] }
const CATS = { general: 'ทั่วไป', workplace: 'สถานที่ทำงาน', process: 'กระบวนการทำงาน', manager: 'หัวหน้า/ทีม', benefit: 'สวัสดิการ', learning: 'การพัฒนา', culture: 'วัฒนธรรม', communication: 'การสื่อสาร' }
const HELP = [
  ['Headphones', 'HR Helpdesk', 'โทร 1234 · LINE @hr-care', 'จ-ศ 08:30-17:30', 'blue'],
  ['HeartHandshake', 'EAP ปรึกษาเป็นความลับ', '1323 / ปรึกษานักจิตวิทยาฟรี', '24 ชม.', 'violet'],
  ['ShieldAlert', 'Ethics Hotline', 'แจ้งเรื่องร้องเรียน/การล่วงละเมิด', 'ปกป้องผู้แจ้ง', 'red']
]

export default function Voice() {
  const app = useApp()
  const [tab, setTab] = useState(app.isHR ? 'inbox' : 'new')
  const [form, setForm] = useState({ feedback_type: 'suggestion', category: 'general', subject: '', body: '', anon: false })
  const [code, setCode] = useState(null)
  const [lookup, setLookup] = useState('')
  const [found, setFound] = useState(undefined)
  const [filter, setFilter] = useState('open')
  const [reply, setReply] = useState(null)
  const [d, reload] = useLoad(() => list('er_feedback', { order: 'created_at' }), [])

  const mine = (d || []).filter((f) => f.employee_id === app.me.id)
  const inbox = (d || []).filter((f) => filter === 'all' || (filter === 'open' ? ['new', 'in_review'].includes(f.status) : f.status === filter))

  async function submit(e) {
    e.preventDefault()
    const c = await rpc('er_submit_feedback', { p_type: form.feedback_type, p_category: form.category, p_subject: form.subject, p_body: form.body, p_anonymous: form.anon })
    setCode(c); setForm({ ...form, subject: '', body: '' }); reload()
  }
  async function find() { setFound(await rpc('er_feedback_lookup', { p_code: lookup })) }
  async function saveReply(e) {
    e.preventDefault()
    await update('er_feedback', { id: reply.id }, { status: reply.status, response: reply.response, responded_by: app.me.id, responded_at: new Date().toISOString() })
    setReply(null); app.toast('บันทึกการตอบกลับแล้ว'); reload()
  }
  async function toCase(f) {
    await insert('er_cases', { case_type: f.feedback_type === 'concern' ? 'grievance' : 'other', severity: 'medium', status: 'open', title: f.subject, description: f.body, channel: 'feedback', reporter_id: f.employee_id, assigned_to: app.me.id, is_confidential: true })
    await update('er_feedback', { id: f.id }, { status: 'in_review' })
    setReply(null); app.toast('สร้าง ER Case แล้ว — ดูได้ที่ ER Case Management'); reload()
  }

  return (
    <div>
      <PageHead eyebrow="รับฟังและช่วยเหลือ" title="Voice of Employee · เราพร้อมรับฟัง" sub="ทุกเสียงมีความหมาย ส่งข้อเสนอแนะ คำถาม หรือข้อกังวล — เลือกไม่ระบุตัวตนได้" />

      <div className="grid g3 mb16">
        {HELP.map(([icon, t, s, tag, th], i) => (
          <div key={t} className="card row card-pad" style={{ gap: 14 }}>
            <Cover theme={th === 'red' ? 'pink' : th} height={52} style={{ width: 52, borderRadius: 14, flexShrink: 0 }}><div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><Icon name={icon} size={22} color="#fff" /></div></Cover>
            <div style={{ minWidth: 0 }}><div className="bold">{t}</div><div className="small muted">{s}</div><Badge tone={th}>{tag}</Badge></div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onChange={setTab} items={[...(app.isHR ? [['inbox', `กล่องรับเรื่อง (${(d || []).filter((f) => f.status === 'new').length} ใหม่)`]] : []), ['new', 'ส่งความคิดเห็น'], ['mine', `ของฉัน (${mine.length})`], ['track', 'ติดตามด้วยรหัส']]} />

      {tab === 'new' && (
        <div className="grid mt16" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(260px,1fr)' }}>
          <form className="card card-pad" onSubmit={submit}>
            <div className="row wrap mb16" style={{ gap: 8 }}>
              {Object.entries(FB_TYPE).map(([k, [l, tone, icon]]) => (
                <button type="button" key={k} className={`react ${form.feedback_type === k ? 'on' : ''}`} onClick={() => setForm({ ...form, feedback_type: k })}><Icon name={icon} size={14} /> {l}</button>
              ))}
            </div>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="หมวดหมู่"><select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="หัวข้อ"><input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            </div>
            <Field label="รายละเอียด"><textarea className="textarea" rows={5} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <label className="check mb16"><input type="checkbox" checked={form.anon} onChange={(e) => setForm({ ...form, anon: e.target.checked })} /> ส่งแบบไม่ระบุตัวตน (ระบบจะไม่บันทึกชื่อคุณ — ใช้รหัสติดตามแทน)</label>
            <button className="btn btn-primary"><Send size={15} /> ส่งถึงทีม HR</button>
          </form>
          <div className="card card-pad" style={{ background: 'linear-gradient(135deg,#fff,#fef2f2)' }}>
            <ShieldAlert color="var(--red)" />
            <div className="bold mt8">เรื่องร้ายแรง เช่น การล่วงละเมิด การทุจริต</div>
            <p className="small muted mt8">กรุณาแจ้งผ่าน Ethics Hotline หรือเลือก "ข้อกังวล" — ทีม ER จะเปิดเคสและดูแลเป็นความลับ ผู้แจ้งได้รับความคุ้มครองตามนโยบาย Whistleblower</p>
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div className="card mt16">{mine.length === 0 ? <Empty text="คุณยังไม่เคยส่งความคิดเห็น (แบบระบุตัวตน)" /> : mine.map((f) => <FbRow key={f.id} f={f} />)}</div>
      )}

      {tab === 'track' && (
        <div className="card card-pad mt16" style={{ maxWidth: 560 }}>
          <div className="bold">ติดตามสถานะด้วยรหัสอ้างอิง</div>
          <p className="small muted mt8">สำหรับเรื่องที่ส่งแบบไม่ระบุตัวตน</p>
          <div className="row mt12"><input className="input" placeholder="เช่น 7F3K2Q9A" value={lookup} onChange={(e) => setLookup(e.target.value)} /><button className="btn btn-primary" onClick={find}><Search size={15} /> ค้นหา</button></div>
          {found === null && <p className="small mt12" style={{ color: 'var(--red)' }}>ไม่พบรหัสนี้</p>}
          {found && <div className="mt16" style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 12 }}><div className="bold">{found.subject}</div><div className="mt8"><Badge tone={FB_STATUS[found.status][1]}>{FB_STATUS[found.status][0]}</Badge></div>{found.response && <p className="small mt8">💬 {found.response}</p>}</div>}
        </div>
      )}

      {tab === 'inbox' && app.isHR && (
        <>
          <div className="grid g4 mt16 mb16">
            <Stat label="เรื่องใหม่" value={(d || []).filter((f) => f.status === 'new').length} icon="Inbox" />
            <Stat label="กำลังพิจารณา" value={(d || []).filter((f) => f.status === 'in_review').length} icon="Hourglass" tone="amber" />
            <Stat label="นำไปปฏิบัติแล้ว" value={(d || []).filter((f) => f.status === 'implemented').length} icon="Rocket" tone="violet" />
            <Stat label="ไม่ระบุตัวตน" value={Math.round((100 * (d || []).filter((f) => f.is_anonymous).length) / Math.max(1, (d || []).length))} unit="%" icon="EyeOff" tone="teal" foot="สัญญาณความไว้วางใจ" />
          </div>
          <div className="card">
            <div className="card-pad" style={{ paddingBottom: 4 }}><Tabs value={filter} onChange={setFilter} items={[['open', 'รอดำเนินการ'], ['answered', 'ตอบแล้ว'], ['implemented', 'นำไปปฏิบัติ'], ['all', 'ทั้งหมด']]} /></div>
            {inbox.map((f) => <FbRow key={f.id} f={f} hr onClick={() => setReply({ ...f, response: f.response || '', status: f.status === 'new' ? 'answered' : f.status })} />)}
            {inbox.length === 0 && <Empty text="ไม่มีรายการ" />}
          </div>
        </>
      )}

      <Modal open={!!code} onClose={() => setCode(null)} title="ส่งเรียบร้อย ขอบคุณที่บอกเรา 💙">
        <p className="muted">เก็บรหัสนี้ไว้เพื่อติดตามสถานะ (โดยเฉพาะหากส่งแบบไม่ระบุตัวตน)</p>
        <div className="en mt16" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '.15em', textAlign: 'center', background: 'var(--primary-50)', color: 'var(--primary)', padding: 16, borderRadius: 14 }}>{code}</div>
      </Modal>

      <Modal open={!!reply} onClose={() => setReply(null)} title={reply?.subject} sub={reply ? `${FB_TYPE[reply.feedback_type][0]} · ${CATS[reply.category] || reply.category} · ${reply.is_anonymous ? 'ไม่ระบุตัวตน' : fullName(app.empById[reply.employee_id])}` : ''}>
        {reply && (
          <form onSubmit={saveReply}>
            <p style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 12 }}>{reply.body}</p>
            <Field label="สถานะ"><select className="select" value={reply.status} onChange={(e) => setReply({ ...reply, status: e.target.value })}>{Object.entries(FB_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="ตอบกลับพนักงาน"><textarea className="textarea" value={reply.response} onChange={(e) => setReply({ ...reply, response: e.target.value })} /></Field>
            <div className="row">
              <button className="btn btn-primary" style={{ flex: 1 }}>บันทึก</button>
              <button type="button" className="btn btn-ghost" onClick={() => toCase(reply)}><ShieldAlert size={15} /> เปิดเป็น ER Case</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function FbRow({ f, hr, onClick }) {
  const app = useApp()
  const [l, tone, icon] = FB_TYPE[f.feedback_type]
  return (
    <div className={`feed-item ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className={`ico b-${tone}`}><Icon name={icon} size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row between wrap"><div className="bold">{f.subject}</div><Badge tone={FB_STATUS[f.status][1]}>{FB_STATUS[f.status][0]}</Badge></div>
          <div className="tiny faint">{l} · {CATS[f.category] || f.category} · {ago(f.created_at)}{hr ? ` · ${f.is_anonymous ? '🔒 ไม่ระบุตัวตน' : fullName(app.empById[f.employee_id])}` : ''} · #{f.ref_code}</div>
          <p className="small muted mt8 clamp2">{f.body}</p>
          {f.response && <div className="small mt8" style={{ background: 'var(--green-50)', borderRadius: 10, padding: '8px 12px' }}>💬 HR: {f.response}</div>}
        </div>
      </div>
    </div>
  )
}
