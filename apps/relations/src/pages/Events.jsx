import { useState } from 'react'
import { Plus, MapPin, Clock, Users, Star } from 'lucide-react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list, remove, update } from '../lib/api'
import { Avatar, Badge, Cover, Field, Modal, PageHead, Stat, Tabs, thDate, thTime, NOW, Person } from '../components/ui'

const TYPE = { activity: ['กิจกรรม', 'Sparkles'], campaign: ['แคมเปญ', 'Flag'], townhall: ['Town Hall', 'Mic'], csr: ['CSR / จิตอาสา', 'HandHeart'], wellbeing: ['Wellbeing', 'HeartPulse'], celebration: ['ฉลอง', 'PartyPopper'], learning: ['เรียนรู้', 'BookOpen'] }

export default function Events() {
  const app = useApp()
  const [tab, setTab] = useState('upcoming')
  const [view, setView] = useState(null)
  const [form, setForm] = useState(null)
  const [d, reload] = useLoad(async () => {
    const [events, parts] = await Promise.all([list('er_events', { order: 'start_at', ascending: true }), list('er_event_participants')])
    return { events, parts }
  }, [])

  const isPast = (e) => new Date(e.end_at || e.start_at) < NOW || e.status === 'completed'
  const events = (d?.events || []).filter((e) => (tab === 'all' ? true : tab === 'upcoming' ? !isPast(e) : isPast(e)))
  const partsOf = (id) => (d?.parts || []).filter((p) => p.event_id === id && p.status !== 'cancelled')
  const mine = (id) => (d?.parts || []).find((p) => p.event_id === id && p.employee_id === app.me.id)
  const totalJoin = (d?.parts || []).length
  const rated = (d?.parts || []).filter((p) => p.rating)

  async function join(e) {
    if (mine(e.id)) { await remove('er_event_participants', { event_id: e.id, employee_id: app.me.id }); app.toast('ยกเลิกการลงทะเบียนแล้ว') }
    else { await insert('er_event_participants', { event_id: e.id, employee_id: app.me.id, status: 'registered' }); app.toast(`ลงทะเบียน "${e.title}" แล้ว · รับ ${e.points} คะแนน`) }
    reload()
  }
  async function rate(e, rating) {
    await update('er_event_participants', { event_id: e.id, employee_id: app.me.id }, { rating, status: 'attended' }); app.toast('ขอบคุณสำหรับคะแนน'); reload()
  }
  async function save(ev) {
    ev.preventDefault()
    const { date, time, ...rest } = form
    await insert('er_events', { ...rest, capacity: rest.capacity ? +rest.capacity : null, points: +rest.points || 0, start_at: new Date(`${date}T${time || '09:00'}:00`).toISOString(), organizer_id: app.me.id, status: 'open' })
    setForm(null); app.toast('สร้างกิจกรรมแล้ว'); reload()
  }

  return (
    <div>
      <PageHead eyebrow="กิจกรรม & แคมเปญ" title="Engagement · กิจกรรมและแคมเปญ" sub="วางแผน จัดการ และติดตามผลกิจกรรมที่สร้างความผูกพัน">
        {app.isHR && <button className="btn btn-primary" onClick={() => setForm({ title: '', description: '', event_type: 'activity', cover_theme: 'green', date: '', time: '09:00', location: '', capacity: '', points: 10 })}><Plus size={16} /> สร้างกิจกรรม</button>}
      </PageHead>

      <div className="grid g4 mb16">
        <Stat label="กิจกรรมที่เปิดรับ" value={(d?.events || []).filter((e) => !isPast(e)).length} icon="CalendarHeart" tone="pink" />
        <Stat label="การเข้าร่วมทั้งหมด" value={totalJoin} unit="ครั้ง" icon="Users" />
        <Stat label="พนักงานที่เคยร่วม" value={Math.round((100 * new Set((d?.parts || []).map((p) => p.employee_id)).size) / Math.max(1, app.employees.length))} unit="%" icon="UserCheck" tone="green" />
        <Stat label="ความพึงพอใจเฉลี่ย" value={rated.length ? (rated.reduce((a, p) => a + p.rating, 0) / rated.length).toFixed(1) : '-'} unit="/5" icon="Star" tone="amber" />
      </div>

      <Tabs value={tab} onChange={setTab} items={[['upcoming', 'กำลังจะมาถึง'], ['past', 'ที่ผ่านมา'], ['all', 'ทั้งหมด']]} />

      <div className="grid g3 mt16">
        {events.map((e, i) => {
          const ps = partsOf(e.id); const my = mine(e.id); const past = isPast(e); const full = e.capacity && ps.length >= e.capacity
          return (
            <div key={e.id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Cover theme={e.cover_theme} height={140} variant={i} icon={TYPE[e.event_type]?.[1]} style={{ borderRadius: 0 }}>
                <div style={{ padding: 14 }}><span className="badge" style={{ background: 'rgba(255,255,255,.9)', color: 'var(--text)' }}>{TYPE[e.event_type]?.[0]}</span></div>
              </Cover>
              <div className="card-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="bold">{e.title}</div>
                <p className="small muted clamp2 mt8">{e.description}</p>
                <div className="small muted mt12" style={{ display: 'grid', gap: 4 }}>
                  <span className="row" style={{ gap: 6 }}><Clock size={14} /> {thDate(e.start_at)}{e.end_at && e.end_at.slice(0, 10) !== e.start_at.slice(0, 10) ? ` – ${thDate(e.end_at)}` : ` · ${thTime(e.start_at)} น.`}</span>
                  <span className="row" style={{ gap: 6 }}><MapPin size={14} /> {e.location || '-'}</span>
                  <span className="row" style={{ gap: 6 }}><Users size={14} /> {ps.length}{e.capacity ? `/${e.capacity}` : ''} คน · <Star size={14} /> {e.points} คะแนน</span>
                </div>
                <div className="row between mt16" style={{ marginTop: 'auto', paddingTop: 14 }}>
                  <div className="avatar-stack clickable" onClick={() => setView(e)}>{ps.slice(0, 5).map((p) => <Avatar key={p.employee_id} emp={app.empById[p.employee_id]} size={28} />)}</div>
                  {past ? (
                    my ? (
                      <div className="row" style={{ gap: 2 }} title="ให้คะแนนกิจกรรม">
                        {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => rate(e, n)} style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 18, color: n <= (my.rating || 0) ? '#F59E0B' : '#d6dbea' }}>★</button>)}
                      </div>
                    ) : <Badge tone="gray">จบแล้ว</Badge>
                  ) : (
                    <button className={`btn btn-sm ${my ? 'btn-ghost' : 'btn-primary'}`} disabled={!my && full} onClick={() => join(e)}>{my ? 'ยกเลิก' : full ? 'เต็มแล้ว' : 'Join'}</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={!!view} onClose={() => setView(null)} title={view?.title} sub={`ผู้เข้าร่วม ${view ? partsOf(view.id).length : 0} คน`}>
        {view && partsOf(view.id).map((p) => (
          <div key={p.employee_id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <Person emp={app.empById[p.employee_id]} size={32} deptById={app.deptById} />
            {p.rating ? <Badge tone="amber">★ {p.rating}</Badge> : <Badge tone="gray">{p.status === 'attended' ? 'เข้าร่วมแล้ว' : 'ลงทะเบียน'}</Badge>}
          </div>
        ))}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title="สร้างกิจกรรม / แคมเปญ">
        {form && (
          <form onSubmit={save}>
            <Field label="ชื่อกิจกรรม"><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="รายละเอียด"><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="ประเภท"><select className="select" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>{Object.entries(TYPE).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="สีหน้าปก"><select className="select" value={form.cover_theme} onChange={(e) => setForm({ ...form, cover_theme: e.target.value })}>{['blue', 'violet', 'pink', 'green', 'teal', 'amber'].map((k) => <option key={k}>{k}</option>)}</select></Field>
              <Field label="วันที่"><input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="เวลา"><input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
              <Field label="สถานที่"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              <Field label="จำนวนรับ (ว่าง = ไม่จำกัด)"><input className="input" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
            </div>
            <Field label="คะแนนที่ได้รับ" hint="คะแนนสะสมสามารถส่งต่อไประบบ Payroll เพื่อแลกรางวัล/สวัสดิการ"><input className="input" type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></Field>
            <button className="btn btn-primary btn-block">บันทึกและเปิดรับสมัคร</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
