import { useState } from 'react'
import { Plus, Lock } from 'lucide-react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list, update } from '../lib/api'
import { Badge, Field, Modal, PageHead, Person, Stat, Tabs, thDate, ago, daysUntil, fullName } from '../components/ui'

const TYPE = { grievance: 'ร้องทุกข์', conflict: 'ข้อขัดแย้ง', harassment: 'การล่วงละเมิด', misconduct: 'ประพฤติผิดวินัย', attendance: 'การมาทำงาน', performance: 'ผลงาน (PIP)', policy: 'สอบถามนโยบาย/กฎหมาย', other: 'อื่นๆ' }
const SEV = { low: ['ต่ำ', 'gray'], medium: ['กลาง', 'amber'], high: ['สูง', 'red'], critical: ['วิกฤต', 'red'] }
const STATUS = [['open', 'เปิดเคส'], ['investigating', 'สอบข้อเท็จจริง'], ['pending_action', 'รอดำเนินการ'], ['resolved', 'แก้ไขแล้ว'], ['closed', 'ปิดเคส']]
const OUTCOME = { no_action: 'ไม่มีมูล/ไม่ดำเนินการ', coaching: 'Coaching', verbal_warning: 'ตักเตือนวาจา', written_warning: 'ตักเตือนเป็นหนังสือ', suspension: 'พักงาน', termination: 'เลิกจ้าง', mediation: 'ไกล่เกลี่ย', policy_change: 'ปรับนโยบาย' }
const NOTE = { note: 'บันทึก', interview: 'สัมภาษณ์', evidence: 'หลักฐาน', action: 'การดำเนินการ', status: 'สถานะ' }

export default function Cases() {
  const app = useApp()
  const [view, setView] = useState('board')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const [note, setNote] = useState({ note_type: 'note', body: '' })
  const [d, reload] = useLoad(async () => {
    const [cases, notes] = await Promise.all([list('er_cases', { order: 'opened_at' }), list('er_case_notes', { order: 'created_at', ascending: true })])
    return { cases, notes }
  }, [])
  const cases = d?.cases || []
  const active = cases.filter((c) => !['resolved', 'closed'].includes(c.status))
  const closed = cases.filter((c) => c.closed_at)
  const avgDays = closed.length ? Math.round(closed.reduce((a, c) => a + (new Date(c.closed_at) - new Date(c.opened_at)) / 86400000, 0) / closed.length) : '-'
  const cur = open && cases.find((c) => c.id === open)

  async function move(c, status) {
    await update('er_cases', { id: c.id }, { status, ...(status === 'closed' ? { closed_at: new Date().toISOString() } : {}) })
    await insert('er_case_notes', { case_id: c.id, author_id: app.me.id, note_type: 'status', body: `เปลี่ยนสถานะเป็น "${STATUS.find((s) => s[0] === status)[1]}"` })
    reload()
  }
  async function addNote(e) {
    e.preventDefault()
    if (!note.body.trim()) return
    await insert('er_case_notes', { case_id: cur.id, author_id: app.me.id, ...note })
    setNote({ note_type: 'note', body: '' }); reload()
  }
  async function save(e) {
    e.preventDefault()
    const n = String(cases.length + 41).padStart(4, '0')
    const row = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    if (app.isDemo) row.case_no = `ER-${new Date().getFullYear()}-${n}` // ฐานข้อมูลจริงสร้างเลขเคสให้อัตโนมัติ
    await insert('er_cases', { ...row, assigned_to: app.me.id, opened_at: new Date().toISOString(), is_confidential: true })
    setForm(null); app.toast('เปิดเคสแล้ว'); reload()
  }

  const Card = ({ c }) => {
    const dd = c.due_date ? daysUntil(c.due_date) : null
    return (
      <div className="kanban-card" onClick={() => setOpen(c.id)}>
        <div className="row between"><span className="tiny faint en">{c.case_no}</span><Badge tone={SEV[c.severity][1]}>{SEV[c.severity][0]}</Badge></div>
        <div className="small bold mt8">{c.title}</div>
        <div className="tiny faint mt8">{TYPE[c.case_type]} · {app.deptById[c.department_id]?.name || '-'}</div>
        {dd != null && !['resolved', 'closed'].includes(c.status) && <div className="tiny mt8" style={{ color: dd < 0 ? 'var(--red)' : 'var(--text-3)' }}>{dd < 0 ? `เลยกำหนด ${-dd} วัน` : `กำหนด ${thDate(c.due_date)}`}</div>}
      </div>
    )
  }

  return (
    <div>
      <PageHead eyebrow="Employee Relations" title="ER Case Management" sub="บริหารเรื่องร้องทุกข์ ข้อพิพาท และวินัย อย่างเป็นธรรม โปร่งใส และเป็นความลับ">
        <Badge tone="violet" icon="Lock">เข้าถึงได้เฉพาะ HR/ER</Badge>
        <button className="btn btn-primary" onClick={() => setForm({ case_type: 'grievance', severity: 'medium', status: 'open', title: '', description: '', channel: 'hr', department_id: '', reporter_id: '', subject_id: '', due_date: '' })}><Plus size={16} /> เปิดเคสใหม่</button>
      </PageHead>

      <div className="grid g4 mb16">
        <Stat label="เคสที่เปิดอยู่" value={active.length} icon="FolderOpen" tone="blue" />
        <Stat label="ความรุนแรงสูง/วิกฤต" value={active.filter((c) => ['high', 'critical'].includes(c.severity)).length} icon="Siren" tone="red" />
        <Stat label="เลยกำหนด" value={active.filter((c) => c.due_date && daysUntil(c.due_date) < 0).length} icon="AlarmClock" tone="amber" />
        <Stat label="ระยะเวลาปิดเคสเฉลี่ย" value={avgDays} unit="วัน" icon="Timer" tone="green" />
      </div>

      <Tabs value={view} onChange={setView} items={[['board', 'Kanban'], ['list', 'รายการ']]} />
      {view === 'board' ? (
        <div className="kanban mt16">
          {STATUS.map(([k, l]) => (
            <div key={k} className="kanban-col">
              <div className="row between"><b className="small">{l}</b><Badge tone="gray">{cases.filter((c) => c.status === k).length}</Badge></div>
              {cases.filter((c) => c.status === k).map((c) => <Card key={c.id} c={c} />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="card mt16 table-wrap">
          <table className="table">
            <thead><tr><th>เลขเคส</th><th>เรื่อง</th><th>ประเภท</th><th>ความรุนแรง</th><th>สถานะ</th><th>เปิดเมื่อ</th></tr></thead>
            <tbody>{cases.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setOpen(c.id)}>
                <td className="small en">{c.case_no}</td><td className="small bold">{c.title}</td><td className="small">{TYPE[c.case_type]}</td>
                <td><Badge tone={SEV[c.severity][1]}>{SEV[c.severity][0]}</Badge></td>
                <td><Badge tone="blue">{STATUS.find((s) => s[0] === c.status)[1]}</Badge></td><td className="small">{thDate(c.opened_at)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      <Modal open={!!cur} onClose={() => setOpen(null)} title={cur ? `${cur.case_no} · ${cur.title}` : ''} sub={cur ? `${TYPE[cur.case_type]} · ช่องทาง ${cur.channel} · เปิด ${thDate(cur.opened_at)}` : ''} wide>
        {cur && (
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 20 }}>
            <div>
              <div className="row wrap mb16" style={{ gap: 6 }}>
                <Badge tone={SEV[cur.severity][1]}>ความรุนแรง: {SEV[cur.severity][0]}</Badge>
                {cur.is_confidential && <Badge tone="violet" icon="Lock">Confidential</Badge>}
                {cur.outcome && <Badge tone="green">ผล: {OUTCOME[cur.outcome]}</Badge>}
              </div>
              <p className="small" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 12 }}>{cur.description}</p>
              <div className="small bold mt16 mb8">บันทึกการดำเนินการ</div>
              <div className="timeline">
                {d.notes.filter((n) => n.case_id === cur.id).map((n) => (
                  <div key={n.id} className="tl-item done"><div className="small"><Badge tone="gray">{NOTE[n.note_type]}</Badge> {n.body}</div><div className="tiny faint">{fullName(app.empById[n.author_id])} · {ago(n.created_at)}</div></div>
                ))}
              </div>
              <form className="row mt8" onSubmit={addNote}>
                <select className="select" style={{ width: 130 }} value={note.note_type} onChange={(e) => setNote({ ...note, note_type: e.target.value })}>{Object.entries(NOTE).filter(([k]) => k !== 'status').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input className="input" placeholder="เพิ่มบันทึก…" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} />
                <button className="btn btn-primary">เพิ่ม</button>
              </form>
            </div>
            <div>
              <div className="small bold mb8">ผู้เกี่ยวข้อง</div>
              <div className="mb8 tiny faint">ผู้ร้อง</div><Person emp={app.empById[cur.reporter_id]} size={32} />
              <div className="mb8 mt12 tiny faint">ผู้ถูกร้อง / เกี่ยวข้อง</div><Person emp={app.empById[cur.subject_id]} size={32} />
              <div className="mb8 mt12 tiny faint">ผู้รับผิดชอบ</div><Person emp={app.empById[cur.assigned_to]} size={32} />
              <div className="small bold mt24 mb8">ย้ายสถานะ</div>
              <div className="row wrap" style={{ gap: 6 }}>{STATUS.map(([k, l]) => <button key={k} className={`btn btn-sm ${cur.status === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => move(cur, k)}>{l}</button>)}</div>
              <Field label="ผลการพิจารณา"><select className="select mt8" value={cur.outcome || ''} onChange={async (e) => { await update('er_cases', { id: cur.id }, { outcome: e.target.value || null }); reload() }}><option value="">— ยังไม่สรุป —</option>{Object.entries(OUTCOME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <p className="tiny faint"><Lock size={11} /> ทุกการเปลี่ยนแปลงถูกบันทึกเพื่อการตรวจสอบ · ปฏิบัติตาม พ.ร.บ.คุ้มครองแรงงาน และ PDPA</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title="เปิดเคส ER ใหม่">
        {form && (
          <form onSubmit={save}>
            <Field label="หัวเรื่อง"><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="ประเภท"><select className="select" value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>{Object.entries(TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="ความรุนแรง"><select className="select" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{Object.entries(SEV).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="ช่องทาง"><select className="select" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{['hr', 'hotline', 'manager', 'self_service', 'feedback'].map((k) => <option key={k}>{k}</option>)}</select></Field>
              <Field label="กำหนดเสร็จ"><input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
              <Field label="ผู้ร้อง"><select className="select" value={form.reporter_id} onChange={(e) => setForm({ ...form, reporter_id: e.target.value })}><option value="">— ไม่ระบุ —</option>{app.employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></Field>
              <Field label="ผู้ถูกร้อง/เกี่ยวข้อง"><select className="select" value={form.subject_id} onChange={(e) => { const emp = app.empById[e.target.value]; setForm({ ...form, subject_id: e.target.value, department_id: emp?.department_id || form.department_id }) }}><option value="">— ไม่ระบุ —</option>{app.employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></Field>
            </div>
            <Field label="รายละเอียด"><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <button className="btn btn-primary btn-block">เปิดเคส</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
