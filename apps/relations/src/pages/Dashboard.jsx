import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { list, rpc } from '../lib/api'
import { Avatar, Badge, Cover, Icon, Ring, Stat, thDate, thTime, ago, daysUntil, fullName, NOW } from '../components/ui'

const QUICK = [
  ['Give Recognition', 'ส่งคำชื่นชม', 'Gift', '#3B5BFD', '/recognition?new=1'],
  ['Join Event', 'ร่วมกิจกรรม', 'CalendarDays', '#EC4899', '/events'],
  ['Give Feedback', 'ส่งความคิดเห็น', 'MessagesSquare', '#14B8A6', '/voice'],
  ['Wellbeing', 'ดูแลตัวเอง', 'Heart', '#EF4444', '/wellbeing'],
  ['Learning & Growth', 'พัฒนาตนเอง', 'Leaf', '#10B981', '/growth'],
  ['Our Culture', 'วัฒนธรรมเรา', 'Users', '#8B5CF6', '/culture']
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

export default function Dashboard() {
  const app = useApp()
  const nav = useNavigate()
  const [d] = useLoad(async () => {
    const [ann, events, parts, recs, surveys, part, miles, fb] = await Promise.all([
      list('er_announcements', { order: 'published_at', limit: 20 }),
      list('er_events', { order: 'start_at', ascending: true }),
      list('er_event_participants'),
      list('er_recognitions', { order: 'created_at', limit: 200 }),
      list('er_surveys', { order: 'open_at' }),
      list('er_survey_participation', { eq: { employee_id: app.me.id } }),
      list('er_journey_milestones'),
      app.isHR ? list('er_feedback') : Promise.resolve([])
    ])
    const latest = surveys.find((s) => s.status === 'open') || surveys.find((s) => s.status === 'closed')
    let results = null
    if (app.isHR && latest) results = await rpc('er_survey_results', { p_survey: latest.id }).catch(() => null)
    return { ann, events, parts, recs, surveys, part, miles, fb, latest, results }
  }, [app.me.id, app.isHR])

  const monthStart = new Date(NOW.getFullYear(), NOW.getMonth(), 1)
  const upcoming = (d?.events || []).filter((e) => new Date(e.end_at || e.start_at) >= NOW && e.status === 'open')
  const recMonth = (d?.recs || []).filter((r) => new Date(r.created_at) >= monthStart)
  const lik = d?.results?.questions?.filter((q) => q.q_type === 'likert') || []
  const engagement = lik.length ? Math.round(lik.reduce((a, q) => a + (q.favorable || 0), 0) / lik.length) : null
  const participation = d?.results ? Math.round((100 * d.results.responses) / Math.max(1, d.results.invited)) : null
  const attended = (d?.parts || []).filter((p) => p.rating)
  const sat = attended.length ? (attended.reduce((a, p) => a + p.rating, 0) / attended.length).toFixed(1) : '-'
  const openSurvey = d?.surveys?.find((s) => s.status === 'open')
  const answered = openSurvey && d?.part?.some((p) => p.survey_id === openSurvey.id)
  const headcount = app.employees.filter((e) => e.status !== 'resigned').length
  const myTeam = new Set(app.employees.filter((e) => e.manager_id === app.me.id).map((e) => e.id))
  const myTasks = (d?.miles || []).filter((m) => m.status !== 'done' && m.status !== 'skipped' &&
    ((m.employee_id === app.me.id && m.owner_role === 'employee') || (app.isHR && m.owner_role === 'hr') || (myTeam.has(m.employee_id) && m.owner_role === 'manager')))
    .filter((m) => daysUntil(m.due_date) <= 21).sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
  const newFb = (d?.fb || []).filter((f) => f.status === 'new').length

  return (
    <div className="stack">
      <div className="row between wrap" style={{ marginTop: 6 }}>
        <div>
          <h1 className="page-title en">{greeting()}, {app.me.nickname || app.me.first_name}! <span style={{ fontSize: 24 }}>☀️</span></h1>
          <p className="page-sub">เพราะ "คน" คือหัวใจของความสำเร็จ มาร่วมสร้างองค์กรที่น่าอยู่ไปด้วยกัน</p>
        </div>
        {openSurvey && !answered && (
          <button className="btn btn-pink" onClick={() => nav('/surveys')}><Icon name="HeartPulse" size={16} /> {openSurvey.title} · ตอบเลย</button>
        )}
      </div>

      <Cover theme="sunrise" height={230} variant={2} style={{ borderRadius: 22, background: 'linear-gradient(120deg,#1e3a8a 0%,#3b5bfd 38%,#f59e0b 85%,#fbbf24 100%)' }}>
        <div className="hero">
          <div className="hero-script">Grow Together<br />&nbsp;&nbsp;Belong Forever</div>
          <div className="hero-sub">เติบโตไปด้วยกัน เพราะที่นี่คือบ้านของเรา</div>
        </div>
      </Cover>

      <div className="grid g6">
        {QUICK.map(([en, th, icon, color, to]) => (
          <div key={en} className="card qa" onClick={() => nav(to)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(to)}>
            <div className="ico" style={{ background: color + '18', color }}><Icon name={icon} size={22} /></div>
            <div className="qa-label en">{en}</div>
            <div className="tiny faint">{th}</div>
          </div>
        ))}
      </div>

      {app.isHR && (
        <div className="grid g4">
          <Stat label="พนักงานทั้งหมด" value={headcount.toLocaleString()} unit="คน" icon="Users" foot={`ทดลองงาน ${app.employees.filter((e) => e.status === 'probation').length} คน`} />
          <Stat label="ความผูกพันโดยรวม" value={engagement ?? '-'} unit="%" icon="HeartPulse" tone="pink" foot={participation != null ? `อัตราการตอบ ${participation}%` : ''} />
          <Stat label="กิจกรรมที่กำลังจะมา" value={upcoming.length} unit="รายการ" icon="CalendarHeart" tone="violet" foot={`ผู้เข้าร่วม ${d?.parts?.length || 0} ครั้ง`} />
          <Stat label="คำร้อง/ข้อเสนอแนะใหม่" value={newFb} unit="รายการ" icon="MessageCircleHeart" tone="amber" foot="รอตอบกลับ" />
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)' }}>
        <div className="card card-pad">
          <div className="card-title">Employee Engagement Score</div>
          {app.isHR ? (
            <div className="row mt16" style={{ gap: 20 }}>
              <Ring value={engagement ?? 0} label={engagement != null ? `${engagement}%` : '-'} />
              <div>
                <div className="bold small">{d?.results?.responses || 0} คำตอบ</div>
                <div className="tiny faint">% ที่ตอบเห็นด้วย (4–5)</div>
                <div className="small muted mt12">{d?.latest?.title}</div>
                <button className="card-link mt8" style={{ padding: 0 }} onClick={() => nav('/surveys')}>ดูผลแบบสำรวจ →</button>
              </div>
            </div>
          ) : (
            <div className="mt16">
              <Ring value={answered ? 100 : 0} label={answered ? '✓' : '!'} sub={answered ? 'ตอบแล้ว ขอบคุณ' : 'ยังไม่ได้ตอบ'} color={answered ? 'var(--green)' : 'var(--pink)'} size={110} />
              <p className="small muted mt12">เสียงของคุณช่วยให้องค์กรดีขึ้น — คำตอบไม่ระบุตัวตน</p>
            </div>
          )}
        </div>
        <div className="card card-pad">
          <div className="card-title mb16">Highlights</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
            {[
              ['Star', '#F59E0B', recMonth.length, 'Recognition this month'],
              ['CalendarDays', '#EC4899', upcoming.length, 'Upcoming Events'],
              ['UserCheck', '#3B5BFD', participation != null ? participation + '%' : '-', 'Participation Rate'],
              ['Heart', '#EF4444', sat + '/5', 'Event Satisfaction']
            ].map(([ic, c, v, l]) => (
              <div key={l} style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 14, background: 'var(--surface-2)' }}>
                <div className="ico" style={{ margin: '0 auto', background: c + '18', color: c, borderRadius: '50%' }}><Icon name={ic} size={18} /></div>
                <div className="en" style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{v}</div>
                <div className="tiny faint">{l}</div>
              </div>
            ))}
            <div style={{ padding: 16, borderRadius: 14, background: 'linear-gradient(135deg,#ecfdf5,#eef2ff)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div><div style={{ fontSize: 28, color: 'var(--green)', lineHeight: 1 }}>“</div><div className="bold small en">Great People Make a Greater Tomorrow</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g3">
        <div className="card card-pad">
          <div className="card-head"><div className="card-title">ข่าวสารล่าสุด</div><button className="card-link" onClick={() => nav('/news')}>ดูทั้งหมด</button></div>
          {(d?.ann || []).slice(0, 3).map((a, i) => (
            <div key={a.id} className="row clickable" style={{ gap: 12, marginBottom: 14, alignItems: 'flex-start' }} onClick={() => nav('/news?id=' + a.id)}>
              <Cover theme={a.cover_theme} height={58} variant={i} style={{ width: 86, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div className="bold small clamp2">{a.title}</div>
                <div className="tiny faint mt8">{thDate(a.published_at)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <div className="card-head"><div className="card-title">กิจกรรมที่กำลังจะมาถึง</div><button className="card-link" onClick={() => nav('/events')}>ดูทั้งหมด</button></div>
          {upcoming.slice(0, 3).map((e) => {
            const dt = new Date(e.start_at)
            return (
              <div key={e.id} className="row clickable" style={{ gap: 14, marginBottom: 14 }} onClick={() => nav('/events')}>
                <div style={{ width: 52, textAlign: 'center', borderRadius: 12, background: 'var(--primary-50)', color: 'var(--primary)', padding: '6px 0', flexShrink: 0 }}>
                  <div className="en" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{dt.getDate()}</div>
                  <div className="tiny">{thDate(dt, false).split(' ')[1]}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="bold small">{e.title}</div>
                  <div className="tiny faint">{thTime(e.start_at)} น. · {e.location}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="card card-pad">
          <div className="card-head"><div className="card-title">สิ่งที่ต้องทำ</div><button className="card-link" onClick={() => nav('/journey')}>People Journey</button></div>
          {myTasks.length === 0 && <p className="small faint">ไม่มีงานค้างใน 3 สัปดาห์นี้ 🎉</p>}
          {myTasks.slice(0, 4).map((m) => {
            const emp = app.empById[m.employee_id]
            const dd = daysUntil(m.due_date)
            return (
              <div key={m.id} className="row" style={{ marginBottom: 12, gap: 10 }}>
                <Avatar emp={emp} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small bold clamp2">{m.title}</div>
                  <div className="tiny faint">{fullName(emp)}</div>
                </div>
                <Badge tone={dd < 0 ? 'red' : dd <= 3 ? 'amber' : 'gray'}>{dd < 0 ? `เลย ${-dd} วัน` : dd === 0 ? 'วันนี้' : `อีก ${dd} วัน`}</Badge>
              </div>
            )
          })}
          {app.isHR && myTasks.length > 4 && <p className="tiny faint">และอีก {myTasks.length - 4} รายการ</p>}
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head"><div className="card-title">คำชื่นชมล่าสุด 💛</div><button className="card-link" onClick={() => nav('/recognition')}>Recognition Wall</button></div>
        <div className="grid g3">
          {(d?.recs || []).slice(0, 3).map((r) => {
            const from = app.empById[r.from_employee_id]; const to = app.empById[r.to_employee_id]; const cv = app.cvById[r.core_value_id]
            return (
              <div key={r.id} className="kudos-card">
                <div className="row"><Avatar emp={to} size={34} /><div className="small"><b>{to?.nickname || to?.first_name}</b> ได้รับคำชมจาก <b>{from?.nickname || from?.first_name}</b><div className="tiny faint">{ago(r.created_at)}</div></div></div>
                <p className="small mt12 clamp3">{r.message}</p>
                {cv && <div className="mt12"><Badge tone="pink" icon={cv.icon}>#{cv.name_en}</Badge></div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
