import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list } from '../lib/api'
import { Avatar, Badge, Cover, Field, Icon, Modal, PageHead, ago, fullName } from '../components/ui'

const PILLARS = [
  ['Compass', 'Vision', 'วิสัยทัศน์', 'เป็นองค์กรที่คนอยากร่วมงานมากที่สุด และสร้างคุณค่าให้สังคมอย่างยั่งยืน'],
  ['Target', 'Mission', 'พันธกิจ', 'พัฒนาคนให้เก่งและดี ส่งมอบสินค้าบริการที่ลูกค้าไว้วางใจ'],
  ['HeartHandshake', 'Promise', 'คำมั่นต่อพนักงาน', 'ที่นี่คุณจะได้เติบโต ได้รับการดูแล และได้รับการยอมรับ']
]

export default function Culture() {
  const app = useApp()
  const [value, setValue] = useState(null)
  const [story, setStory] = useState(null)
  const [d, reload] = useLoad(async () => {
    const [stories, recs] = await Promise.all([list('er_culture_stories', { order: 'created_at' }), list('er_recognitions')])
    return { stories, recs }
  }, [])

  async function save(e) {
    e.preventDefault()
    await insert('er_culture_stories', { ...story, author_id: app.me.id, status: 'published' })
    setStory(null); app.toast('แบ่งปันเรื่องราวแล้ว ขอบคุณที่ส่งต่อวัฒนธรรมที่ดี'); reload()
  }

  return (
    <div>
      <PageHead eyebrow="วัฒนธรรมองค์กร" title="Our Culture · ค่านิยมและเรื่องราวของเรา" sub="ให้ทุกคนเข้าใจ เชื่อ และใช้ค่านิยมในการทำงานทุกวัน">
        <button className="btn btn-primary" onClick={() => setStory({ title: '', body: '', core_value_id: app.coreValues[0]?.id })}><PenLine size={16} /> แบ่งปันเรื่องราว</button>
      </PageHead>

      <Cover theme="blue" height={210} variant={2} style={{ borderRadius: 22, background: 'linear-gradient(120deg,#1e3a8a,#3b5bfd 50%,#8b5cf6)' }}>
        <div className="hero" style={{ minHeight: 210, alignItems: 'center', textAlign: 'center' }}>
          <div className="hero-script">Our Culture</div>
          <div className="en bold" style={{ letterSpacing: '.2em', marginTop: 8 }}>PEOPLE · GROWTH · IMPACT</div>
        </div>
      </Cover>

      <div className="grid g3 mt24">
        {PILLARS.map(([icon, en, th, text]) => (
          <div key={en} className="card card-pad row" style={{ alignItems: 'flex-start', gap: 14 }}>
            <div className="ico" style={{ background: 'var(--primary-50)', color: 'var(--primary)', width: 46, height: 46 }}><Icon name={icon} size={22} /></div>
            <div><div className="bold en">{en} <span className="faint small">· {th}</span></div><p className="small muted mt8">{text}</p></div>
          </div>
        ))}
      </div>

      <h2 className="card-title mt24 mb16" style={{ fontSize: 19 }}>ค่านิยมหลัก (Core Values)</h2>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {app.coreValues.map((v) => {
          const n = (d?.recs || []).filter((r) => r.core_value_id === v.id).length
          return (
            <div key={v.id} className="card card-pad clickable" style={{ borderTop: `4px solid ${v.color}` }} onClick={() => setValue(v)}>
              <div className="ico" style={{ background: v.color + '18', color: v.color, width: 50, height: 50, borderRadius: 16 }}><Icon name={v.icon} size={24} /></div>
              <div className="mt12" style={{ fontSize: 20, fontWeight: 700 }}>{v.name_th}</div>
              <div className="en faint small bold">{v.name_en}</div>
              <p className="small muted mt8 clamp2">{v.description}</p>
              <div className="tiny mt12" style={{ color: v.color }}><b>{n}</b> คำชื่นชมที่สะท้อนค่านิยมนี้</div>
            </div>
          )
        })}
      </div>

      <h2 className="card-title mt24 mb16" style={{ fontSize: 19 }}>Culture Stories · เรื่องเล่าที่มีชีวิต</h2>
      <div className="grid g3">
        {(d?.stories || []).filter((s) => s.status === 'published').map((s, i) => {
          const v = app.cvById[s.core_value_id]; const a = app.empById[s.author_id]
          return (
            <div key={s.id} className="card" style={{ overflow: 'hidden' }}>
              <Cover theme={['pink', 'amber', 'blue', 'green', 'violet'][i % 5]} height={120} icon={v?.icon} variant={i} style={{ borderRadius: 0 }} />
              <div className="card-pad">
                {v && <span className="badge" style={{ background: v.color + '18', color: v.color }}>#{v.name_en}</span>}
                <div className="bold mt8">{s.title}</div>
                <p className="small muted mt8 clamp3">{s.body}</p>
                <div className="row mt12"><Avatar emp={a} size={26} /><span className="tiny faint">{fullName(a)} · {ago(s.created_at)}</span></div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={!!value} onClose={() => setValue(null)} title={value ? `${value.name_th} · ${value.name_en}` : ''} sub={value?.description}>
        {value && (
          <>
            <div className="small bold mb8">พฤติกรรมที่คาดหวัง</div>
            {(value.behaviors || []).map((b) => <div key={b} className="row mb8"><Icon name="CheckCircle2" size={16} color={value.color} /> {b}</div>)}
            <div className="small bold mt24 mb8">ตัวอย่างคำชื่นชมล่าสุด</div>
            {(d?.recs || []).filter((r) => r.core_value_id === value.id).slice(0, 3).map((r) => (
              <div key={r.id} className="kudos-card mb8" style={{ padding: 12 }}><div className="small">{r.message}</div><div className="tiny faint mt8">→ {fullName(app.empById[r.to_employee_id])}</div></div>
            ))}
          </>
        )}
      </Modal>

      <Modal open={!!story} onClose={() => setStory(null)} title="แบ่งปันเรื่องราววัฒนธรรม" sub="เล่าเหตุการณ์จริงที่สะท้อนค่านิยมของเรา">
        {story && (
          <form onSubmit={save}>
            <Field label="ค่านิยมที่เกี่ยวข้อง"><select className="select" value={story.core_value_id} onChange={(e) => setStory({ ...story, core_value_id: e.target.value })}>{app.coreValues.map((v) => <option key={v.id} value={v.id}>{v.name_th} · {v.name_en}</option>)}</select></Field>
            <Field label="หัวเรื่อง"><input className="input" required value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} /></Field>
            <Field label="เรื่องราว"><textarea className="textarea" rows={6} required value={story.body} onChange={(e) => setStory({ ...story, body: e.target.value })} /></Field>
            <button className="btn btn-primary btn-block">เผยแพร่</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
