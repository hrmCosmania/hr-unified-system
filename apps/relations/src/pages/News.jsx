import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pin, CheckCircle2 } from 'lucide-react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list, update } from '../lib/api'
import { Badge, Cover, Field, Modal, PageHead, Tabs, thDate, Bar, pct, Avatar, fullName } from '../components/ui'

export const CAT = { news: ['ข่าวสาร', 'blue'], event: ['กิจกรรม', 'pink'], people: ['People Stories', 'violet'], policy: ['นโยบาย/สวัสดิการ', 'amber'], announcement: ['ประกาศ', 'teal'], ceo: ['สารจากผู้บริหาร', 'blue'] }
const REACTIONS = ['👍', '❤️', '👏', '🎉', '💡']

export default function News() {
  const app = useApp()
  const [params, setParams] = useSearchParams()
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const [d, reload] = useLoad(async () => {
    const [ann, reads] = await Promise.all([list('er_announcements', { order: 'published_at' }), list('er_announcement_reads')])
    return { ann, reads }
  }, [])

  useEffect(() => {
    const id = params.get('id')
    if (id && d) { const a = d.ann.find((x) => x.id === id); if (a) openAnn(a) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, d])

  const anns = (d?.ann || []).filter((a) => cat === 'all' || a.category === cat).sort((a, b) => (b.is_pinned - a.is_pinned) || (a.published_at < b.published_at ? 1 : -1))
  const myRead = (id) => d?.reads.find((r) => r.announcement_id === id && r.employee_id === app.me.id)
  const headcount = app.employees.filter((e) => e.status !== 'resigned').length

  async function openAnn(a) {
    setOpen(a)
    if (!myRead(a.id)) {
      await insert('er_announcement_reads', { announcement_id: a.id, employee_id: app.me.id, acknowledged: false }).catch(() => {})
      reload()
    }
  }
  async function react(a, emoji) {
    await update('er_announcement_reads', { announcement_id: a.id, employee_id: app.me.id }, { reaction: emoji }); reload()
  }
  async function ack(a) {
    await update('er_announcement_reads', { announcement_id: a.id, employee_id: app.me.id }, { acknowledged: true })
    app.toast('รับทราบประกาศแล้ว'); reload()
  }
  async function save(e) {
    e.preventDefault()
    await insert('er_announcements', { ...form, author_id: app.me.id, status: 'published', published_at: new Date().toISOString(), audience: 'all' })
    setForm(null); app.toast('เผยแพร่ข่าวสารแล้ว'); reload()
  }

  const featured = anns[0]
  return (
    <div>
      <PageHead eyebrow="สื่อสารองค์กร" title="ข่าวสารและการสื่อสารภายใน" sub="ทุกเรื่องราวสำคัญขององค์กร ส่งตรงถึงพนักงานทุกคน">
        {app.isHR && <button className="btn btn-primary" onClick={() => setForm({ title: '', summary: '', body: '', category: 'news', cover_theme: 'blue', is_pinned: false, require_ack: false })}><Plus size={16} /> สร้างข่าวสาร</button>}
      </PageHead>

      <Cover theme="green" height={190} variant={0} style={{ borderRadius: 22, background: 'linear-gradient(120deg,#0f766e,#14b8a6 45%,#3b5bfd)' }}>
        <div className="hero" style={{ minHeight: 190, alignItems: 'center', textAlign: 'center' }}>
          <div className="en" style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>Together<br />We Make It Happen</div>
          <div className="hero-sub" style={{ fontSize: 14 }}>อัปเดตทุกความเคลื่อนไหว กิจกรรม และเรื่องราวดีๆ ของพวกเรา</div>
        </div>
      </Cover>

      <div className="row between wrap mt24 mb16">
        <Tabs value={cat} onChange={setCat} items={[['all', 'ทั้งหมด'], ...Object.entries(CAT).map(([k, [l]]) => [k, l])]} />
      </div>

      <div className="grid g3">
        {anns.map((a, i) => {
          const reads = d.reads.filter((r) => r.announcement_id === a.id)
          const read = myRead(a.id)
          return (
            <div key={a.id} className="card clickable" style={{ overflow: 'hidden' }} onClick={() => openAnn(a)}>
              <Cover theme={a.cover_theme} height={150} variant={i} style={{ borderRadius: 0 }}>
                <div style={{ padding: 14 }} className="row">
                  <Badge tone={CAT[a.category]?.[1] || 'blue'}>{CAT[a.category]?.[0]}</Badge>
                  {a.is_pinned && <span className="badge" style={{ background: '#fff', color: 'var(--text)' }}><Pin size={11} /> ปักหมุด</span>}
                </div>
              </Cover>
              <div className="card-pad">
                <div className="bold clamp2" style={{ minHeight: 44 }}>{a.title}</div>
                <p className="small muted clamp2 mt8">{a.summary}</p>
                <div className="row between mt12">
                  <span className="tiny faint">{thDate(a.published_at)}</span>
                  {a.require_ack && (read?.acknowledged ? <Badge tone="green" icon="Check">รับทราบแล้ว</Badge> : <Badge tone="red">ต้องกดรับทราบ</Badge>)}
                  {!a.require_ack && !read && <Badge tone="blue">ใหม่</Badge>}
                </div>
                {app.isHR && (
                  <div className="mt12">
                    <div className="row between tiny faint"><span>อ่านแล้ว {reads.length}/{headcount}</span><span>{pct(reads.length, headcount)}%</span></div>
                    <Bar value={pct(reads.length, headcount)} height={6} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!featured && <p className="faint mt16">ยังไม่มีข่าวในหมวดนี้</p>}

      <Modal open={!!open} onClose={() => { setOpen(null); if (params.get('id')) setParams({}) }} title={open?.title} wide>
        {open && (() => {
          const read = myRead(open.id)
          const author = app.empById[open.author_id]
          return (
            <div>
              <Cover theme={open.cover_theme} height={180} />
              <div className="row mt16"><Avatar emp={author} size={32} /><div className="small"><b>{fullName(author)}</b><div className="tiny faint">{thDate(open.published_at)} · {CAT[open.category]?.[0]}</div></div></div>
              <p className="mt16" style={{ whiteSpace: 'pre-line' }}>{open.body}</p>
              <div className="row wrap mt24">
                {REACTIONS.map((r) => <button key={r} className={`react ${read?.reaction === r ? 'on' : ''}`} onClick={() => react(open, r)}>{r} {d.reads.filter((x) => x.announcement_id === open.id && x.reaction === r).length || ''}</button>)}
                <div style={{ flex: 1 }} />
                {open.require_ack && (read?.acknowledged
                  ? <Badge tone="green" icon="CheckCircle2">คุณรับทราบแล้ว</Badge>
                  : <button className="btn btn-primary" onClick={() => ack(open)}><CheckCircle2 size={16} /> รับทราบ</button>)}
              </div>
            </div>
          )
        })()}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title="สร้างข่าวสาร / ประกาศ">
        {form && (
          <form onSubmit={save}>
            <Field label="หัวข้อ"><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="หมวดหมู่"><select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CAT).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="สีหน้าปก"><select className="select" value={form.cover_theme} onChange={(e) => setForm({ ...form, cover_theme: e.target.value })}>{['blue', 'violet', 'pink', 'green', 'teal', 'amber'].map((k) => <option key={k}>{k}</option>)}</select></Field>
            </div>
            <Field label="สรุปสั้น"><input className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
            <Field label="เนื้อหา"><textarea className="textarea" rows={6} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <div className="row wrap mb16" style={{ gap: 18 }}>
              <label className="check"><input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} /> ปักหมุด</label>
              <label className="check"><input type="checkbox" checked={form.require_ack} onChange={(e) => setForm({ ...form, require_ack: e.target.checked })} /> ต้องกดรับทราบ (นโยบาย/ระเบียบ)</label>
            </div>
            <button className="btn btn-primary btn-block">เผยแพร่</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
