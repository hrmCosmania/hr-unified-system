import { useMemo, useRef, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list, remove } from '../lib/api'
import { Avatar, Badge, Cover, Icon, PageHead, Tabs, ago, fullName, thDate, NOW } from '../components/ui'

export default function Recognition() {
  const app = useApp()
  const [params] = useSearchParams()
  const ref = useRef(null)
  const [tab, setTab] = useState('all')
  const [form, setForm] = useState({ to: '', message: '', core_value_id: '', badge_id: '' })
  const [d, reload] = useLoad(async () => {
    const [recs, reacts, awards] = await Promise.all([list('er_recognitions', { order: 'created_at' }), list('er_recognition_reactions'), list('er_awards', { order: 'awarded_at' })])
    return { recs, reacts, awards }
  }, [])
  useEffect(() => { if (params.get('new')) ref.current?.focus() }, [params])

  const team = useMemo(() => new Set(app.employees.filter((e) => e.department_id === app.me.department_id).map((e) => e.id)), [app.employees, app.me])
  const reactsOf = (id) => (d?.reacts || []).filter((r) => r.recognition_id === id)
  let feed = d?.recs || []
  if (tab === 'team') feed = feed.filter((r) => team.has(r.to_employee_id) || team.has(r.from_employee_id))
  if (tab === 'mine') feed = feed.filter((r) => r.to_employee_id === app.me.id || r.from_employee_id === app.me.id)
  if (tab === 'popular') feed = [...feed].sort((a, b) => reactsOf(b.id).length - reactsOf(a.id).length)

  const since = new Date(NOW.getFullYear(), NOW.getMonth() - 1, NOW.getDate())
  const leaders = Object.entries((d?.recs || []).filter((r) => new Date(r.created_at) >= since).reduce((m, r) => ({ ...m, [r.to_employee_id]: (m[r.to_employee_id] || 0) + r.points }), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
  const byValue = app.coreValues.map((v) => ({ v, n: (d?.recs || []).filter((r) => r.core_value_id === v.id).length }))
  const maxV = Math.max(1, ...byValue.map((x) => x.n))
  const myPoints = (d?.recs || []).filter((r) => r.to_employee_id === app.me.id).reduce((a, r) => a + r.points, 0)

  async function post(e) {
    e.preventDefault()
    if (!form.to || !form.message.trim()) return app.toast('กรุณาเลือกเพื่อนและเขียนข้อความ')
    const badge = app.badgeById[form.badge_id]
    await insert('er_recognitions', { from_employee_id: app.me.id, to_employee_id: form.to, message: form.message.trim(), core_value_id: form.core_value_id || null, badge_id: form.badge_id || null, points: badge?.points || 10, visibility: 'public' })
    setForm({ to: '', message: '', core_value_id: '', badge_id: '' })
    app.toast('ส่งคำชื่นชมแล้ว 💖'); reload()
  }
  async function toggleReact(r) {
    const mine = reactsOf(r.id).find((x) => x.employee_id === app.me.id)
    if (mine) await remove('er_recognition_reactions', { recognition_id: r.id, employee_id: app.me.id })
    else await insert('er_recognition_reactions', { recognition_id: r.id, employee_id: app.me.id, emoji: '👏' })
    reload()
  }

  return (
    <div>
      <PageHead eyebrow="การยกย่องและรางวัล" title="Recognition · ชื่นชมและให้กำลังใจ" sub="คำขอบคุณเล็กๆ สร้างพลังใหญ่ — เชื่อมกับค่านิยมองค์กรทุกครั้งที่ชื่นชม" />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)' }}>
        <div className="stack">
          <form className="card card-pad" onSubmit={post} style={{ background: 'linear-gradient(135deg,#fff,#fdf2f8)' }}>
            <div className="row between"><div><div className="card-title" style={{ color: 'var(--pink)' }}>Share a Recognition</div><div className="small faint">Let's celebrate great people!</div></div><Icon name="Sparkles" color="var(--pink)" /></div>
            <div className="grid g2 mt16" style={{ gap: 10 }}>
              <select className="select" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
                <option value="">— ชื่นชมใคร? —</option>
                {app.employees.filter((e) => e.status !== 'resigned' && e.id !== app.me.id).map((e) => <option key={e.id} value={e.id}>{fullName(e)} ({e.nickname}) · {app.deptById[e.department_id]?.name}</option>)}
              </select>
              <select className="select" value={form.core_value_id} onChange={(e) => setForm({ ...form, core_value_id: e.target.value })}>
                <option value="">— สะท้อนค่านิยมข้อใด —</option>
                {app.coreValues.map((v) => <option key={v.id} value={v.id}>{v.name_th} · {v.name_en}</option>)}
              </select>
            </div>
            <textarea ref={ref} className="textarea mt12" placeholder="เขียนข้อความขอบคุณ / ชื่นชม…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <div className="row wrap mt12" style={{ gap: 6 }}>
              {app.badges.map((b) => (
                <button type="button" key={b.id} className={`react ${form.badge_id === b.id ? 'on' : ''}`} onClick={() => setForm({ ...form, badge_id: form.badge_id === b.id ? '' : b.id })}>
                  <Icon name={b.icon} size={14} color={b.color} /> {b.name} <span className="tiny faint">+{b.points}</span>
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button className="btn btn-pink"><Send size={15} /> Post</button>
            </div>
          </form>

          <div className="card">
            <div className="card-pad" style={{ paddingBottom: 6 }}><Tabs value={tab} onChange={setTab} items={[['all', 'ทั้งหมด'], ['team', 'ทีมของฉัน'], ['mine', 'ของฉัน'], ['popular', 'ยอดนิยม']]} /></div>
            {feed.slice(0, 30).map((r) => {
              const from = app.empById[r.from_employee_id]; const to = app.empById[r.to_employee_id]
              const cv = app.cvById[r.core_value_id]; const b = app.badgeById[r.badge_id]; const rs = reactsOf(r.id)
              const on = rs.some((x) => x.employee_id === app.me.id)
              return (
                <div key={r.id} className="feed-item">
                  <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <Avatar emp={from} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small"><b>{fullName(from)}</b> <span className="faint">ชื่นชม</span> <b>{fullName(to)}</b></div>
                      <div className="tiny faint">{ago(r.created_at)} · {app.deptById[to?.department_id]?.name}</div>
                      <p className="mt8">{r.message}</p>
                      <div className="row wrap mt12" style={{ gap: 6 }}>
                        {b && <span className="badge" style={{ background: b.color + '1a', color: b.color }}><Icon name={b.icon} size={12} /> {b.name}</span>}
                        {cv && <Badge tone="blue">#{cv.name_en}</Badge>}
                        <Badge tone="amber">+{r.points} pts</Badge>
                        <div style={{ flex: 1 }} />
                        <button className={`react ${on ? 'on' : ''}`} onClick={() => toggleReact(r)}>👏 {rs.length || ''}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="stack">
          <Cover theme="amber" height={150} icon="Trophy" variant={1} style={{ background: 'linear-gradient(135deg,#f59e0b,#ec4899)' }}>
            <div style={{ padding: 20 }}>
              <div className="small" style={{ opacity: .9 }}>คะแนนชื่นชมของฉัน</div>
              <div className="en" style={{ fontSize: 40, fontWeight: 800 }}>{myPoints}</div>
              <div className="tiny" style={{ opacity: .9 }}>แลกสวัสดิการ/ของรางวัลผ่านระบบ Payroll</div>
            </div>
          </Cover>
          <div className="card card-pad">
            <div className="card-title mb16">🏆 Top Recognized · 30 วัน</div>
            {leaders.map(([id, pts], i) => (
              <div key={id} className="row mb8">
                <span className="en bold" style={{ width: 18, color: i < 3 ? 'var(--amber)' : 'var(--text-3)' }}>{i + 1}</span>
                <Avatar emp={app.empById[id]} size={32} />
                <div style={{ flex: 1, minWidth: 0 }} className="small bold">{fullName(app.empById[id])}</div>
                <Badge tone="amber">{pts} pts</Badge>
              </div>
            ))}
          </div>
          <div className="card card-pad">
            <div className="card-title mb16">ค่านิยมที่ถูกชื่นชม</div>
            {byValue.map(({ v, n }) => (
              <div key={v.id} className="mb8">
                <div className="row between small"><span className="row" style={{ gap: 6 }}><Icon name={v.icon} size={14} color={v.color} /> {v.name_th}</span><b>{n}</b></div>
                <div className="bar mt8" style={{ height: 6 }}><span style={{ width: `${(100 * n) / maxV}%`, background: v.color }} /></div>
              </div>
            ))}
          </div>
          <div className="card card-pad">
            <div className="card-title mb16">Hall of Fame</div>
            {(d?.awards || []).map((a) => (
              <div key={a.id} className="row mb16" style={{ alignItems: 'flex-start' }}>
                <div className="ico" style={{ background: 'var(--amber-50)', color: 'var(--amber)' }}><Icon name="Award" size={18} /></div>
                <div><div className="small bold">{a.title} · {a.period}</div><div className="small">{fullName(app.empById[a.employee_id])}</div><div className="tiny faint">{a.citation} · {thDate(a.awarded_at)}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
