import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { insert, list, rpc, update } from '../lib/api'
import { Badge, Cover, Icon, PageHead, Tabs, thDate } from '../components/ui'

export const PILLARS = {
  mental: ['Mental Health', 'สุขภาพใจ', 'Brain', '#8B5CF6'],
  physical: ['Physical Health', 'สุขภาพกาย', 'Dumbbell', '#10B981'],
  financial: ['Financial Health', 'สุขภาพการเงิน', 'PiggyBank', '#F59E0B'],
  social: ['Social', 'ความสัมพันธ์', 'Users', '#EC4899'],
  worklife: ['Work-Life Balance', 'สมดุลชีวิต', 'Scale', '#3B5BFD']
}
const MOODS = ['😣', '😕', '😐', '🙂', '😄']
const FORMAT = { content: 'บทความ/คลิป', program: 'โปรแกรม', service: 'บริการ', benefit: 'สวัสดิการ', challenge: 'Challenge' }

export default function Wellbeing() {
  const app = useApp()
  const [pillar, setPillar] = useState('all')
  const [mood, setMood] = useState(null)
  const [stress, setStress] = useState(3)
  const [d, reload] = useLoad(async () => {
    const [programs, checks, trend] = await Promise.all([
      list('er_wellbeing_programs'), list('er_wellbeing_checkins', { eq: { employee_id: app.me.id }, order: 'checkin_on' }),
      app.isHR ? rpc('er_wellbeing_trend', { p_weeks: 12 }).catch(() => []) : Promise.resolve([])
    ])
    return { programs, checks, trend }
  }, [app.me.id, app.isHR])

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCheck = d?.checks.find((c) => c.checkin_on === todayStr)
  const progs = (d?.programs || []).filter((p) => p.is_active && (pillar === 'all' || p.pillar === pillar))

  async function checkin() {
    if (!mood) return
    if (todayCheck) await update('er_wellbeing_checkins', { id: todayCheck.id }, { mood, stress })
    else await insert('er_wellbeing_checkins', { employee_id: app.me.id, mood, stress, checkin_on: todayStr })
    app.toast(mood <= 2 ? 'ขอบคุณที่บอกเรา 💜 หากต้องการคุยกับใคร บริการ EAP พร้อมรับฟัง 24 ชม.' : 'บันทึกแล้ว ขอให้เป็นวันที่ดีนะ!')
    reload()
  }

  return (
    <div>
      <PageHead eyebrow="สวัสดิการและคุณภาพชีวิต" title="Wellbeing · สุขภาวะที่ดีในการทำงาน" sub="ดูแลกาย ใจ การเงิน และความสัมพันธ์ เพื่อให้ทุกคนทำงานอย่างมีความสุข" />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)' }}>
        <Cover theme="teal" height={200} variant={1} icon="Flower2" style={{ borderRadius: 22, background: 'linear-gradient(120deg,#ecfdf5,#ccfbf1 40%,#e0e7ff)', color: 'var(--text)' }}>
          <div className="hero" style={{ minHeight: 200 }}>
            <div style={{ fontSize: 28, fontWeight: 800 }} className="en">Wellbeing for a Better You</div>
            <div className="muted mt8">ดูแลตัวเองให้ดี เพื่อชีวิตที่สมดุล — ข้อมูล check-in ของคุณเป็นความลับ HR เห็นเฉพาะภาพรวม</div>
          </div>
        </Cover>
        <div className="card card-pad">
          <div className="card-title">วันนี้รู้สึกอย่างไร?</div>
          <div className="row between mt16">
            {MOODS.map((m, i) => (
              <button key={i} onClick={() => setMood(i + 1)} style={{ fontSize: 30, border: 0, background: (mood || todayCheck?.mood) === i + 1 ? 'var(--primary-50)' : 'transparent', borderRadius: 14, padding: 6, cursor: 'pointer', transform: (mood || todayCheck?.mood) === i + 1 ? 'scale(1.15)' : 'none', transition: 'all .15s' }}>{m}</button>
            ))}
          </div>
          <div className="small muted mt12">ระดับความเครียด: <b>{stress}</b>/5</div>
          <input type="range" min={1} max={5} value={stress} onChange={(e) => setStress(+e.target.value)} style={{ width: '100%', accentColor: 'var(--primary)' }} />
          <button className="btn btn-primary btn-block mt8" disabled={!mood} onClick={checkin}>{todayCheck ? 'อัปเดต Check-in วันนี้' : 'บันทึก Check-in'}</button>
          <div className="row mt12" style={{ gap: 4 }}>{(d?.checks || []).slice(0, 10).reverse().map((c) => <span key={c.checkin_on} title={thDate(c.checkin_on)} style={{ fontSize: 16 }}>{MOODS[c.mood - 1]}</span>)}</div>
        </div>
      </div>

      <div className="grid mt24" style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12 }}>
        {Object.entries(PILLARS).map(([k, [en, th, icon, c]]) => (
          <div key={k} className="card qa" style={{ outline: pillar === k ? `2px solid ${c}` : 'none' }} onClick={() => setPillar(pillar === k ? 'all' : k)}>
            <div className="ico" style={{ background: c + '18', color: c }}><Icon name={icon} size={22} /></div>
            <div className="qa-label en">{en}</div><div className="tiny faint">{th}</div>
          </div>
        ))}
      </div>

      <div className="row between wrap mt24 mb16">
        <div className="card-title">Recommended for You</div>
        <Tabs value={pillar} onChange={setPillar} items={[['all', 'ทั้งหมด'], ...Object.entries(PILLARS).map(([k, v]) => [k, v[1]])]} />
      </div>
      <div className="grid g4">
        {progs.map((p, i) => {
          const [en, , icon, c] = PILLARS[p.pillar]
          return (
            <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
              <Cover theme={p.cover_theme} height={110} icon={icon} variant={i} style={{ borderRadius: 0 }} />
              <div className="card-pad" style={{ padding: 16 }}>
                <div className="row between"><span className="badge" style={{ background: c + '18', color: c }}>{en}</span><span className="tiny faint">{FORMAT[p.format]}</span></div>
                <div className="bold mt8">{p.title}</div>
                <p className="small muted clamp2 mt8">{p.description}</p>
                <div className="row between mt12"><span className="tiny faint">{p.duration || ''}</span><button className="btn btn-sm btn-soft" onClick={() => app.toast(p.format === 'benefit' ? 'เปิดคำขอสวัสดิการในระบบ Payroll' : 'ลงทะเบียนแล้ว')}>{p.format === 'benefit' ? 'ใช้สิทธิ์' : 'เริ่มเลย'}</button></div>
              </div>
            </div>
          )
        })}
      </div>

      {app.isHR && (
        <div className="card card-pad mt24">
          <div className="card-head"><div><div className="card-title">Wellbeing Pulse ภาพรวมองค์กร</div><div className="small faint">ค่าเฉลี่ยรายสัปดาห์ · แสดงเฉพาะสัปดาห์ที่มีผู้ check-in ≥ 5 คน</div></div><Badge tone="violet" icon="Lock">Aggregated only</Badge></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={d?.trend || []}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis domain={[1, 5]} tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                <Line type="monotone" dataKey="mood" name="อารมณ์ (สูง=ดี)" stroke="#10B981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="stress" name="ความเครียด" stroke="#EF4444" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
