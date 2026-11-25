import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { rpc, list } from '../lib/api'
import { Badge, Bar, Cover, Icon, PageHead, Ring, Stat, thDate, tenureText } from '../components/ui'

const LADDER = ['เจ้าหน้าที่', 'เจ้าหน้าที่อาวุโส', 'หัวหน้างาน', 'ผู้จัดการ', 'ผู้จัดการอาวุโส', 'ผู้อำนวยการ']

export default function Growth() {
  const app = useApp()
  const [d] = useLoad(async () => {
    const [lnd, perf, miles] = await Promise.all([
      rpc('er_lnd_summary', { p_employee: app.me.id }).catch(() => null),
      rpc('er_perf_summary', { p_employee: app.me.id }).catch(() => null),
      list('er_journey_milestones', { eq: { employee_id: app.me.id } })
    ])
    return { lnd, perf, miles }
  }, [app.me.id])
  const lnd = d?.lnd; const perf = d?.perf
  const level = Math.min(LADDER.length, Math.max(1, app.me.job_level || 1))

  return (
    <div>
      <PageHead eyebrow="การพัฒนาพนักงาน" title="Learning & Growth" sub="ข้อมูลเชื่อมโยงจากระบบ L&D และ Performance — เห็นเส้นทางเติบโตของตัวเองในที่เดียว">
        <Badge tone={lnd?.connected ? 'green' : 'gray'} icon="Link">L&D {lnd?.connected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}</Badge>
        <Badge tone={perf?.connected ? 'green' : 'gray'} icon="Link">Performance {perf?.connected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}</Badge>
      </PageHead>

      <Cover theme="green" height={180} icon="Sprout" variant={0} style={{ borderRadius: 22, background: 'linear-gradient(120deg,#065f46,#10b981 55%,#a7f3d0)' }}>
        <div className="hero" style={{ minHeight: 180 }}>
          <div className="hero-script">Keep Growing</div>
          <div className="hero-sub">อายุงาน {tenureText(app.me.hire_date)} · {app.me.position_name}</div>
        </div>
      </Cover>

      <div className="grid g4 mt24">
        <Stat label="หลักสูตรที่เรียนจบ" value={lnd ? `${lnd.completed}/${lnd.courses}` : '-'} icon="BookOpenCheck" tone="green" foot="จากระบบ L&D" />
        <Stat label="ชั่วโมงเรียนรู้สะสม" value={lnd?.hours ?? '-'} unit="ชม." icon="Clock" foot="เป้าหมาย 40 ชม./ปี" />
        <Stat label="ใบรับรอง" value={lnd?.certificates ?? '-'} unit="ใบ" icon="BadgeCheck" tone="violet" />
        <Stat label="Feedback ที่ได้รับ" value={perf?.feedback ?? '-'} icon="MessageSquareHeart" tone="pink" foot="จากระบบ Performance" />
      </div>

      <div className="grid g3 mt24">
        <div className="card card-pad">
          <div className="card-title">ความคืบหน้าเป้าหมายงาน</div>
          <div className="row mt16" style={{ gap: 18 }}>
            <Ring value={perf?.avg_progress ?? 0} size={110} color="var(--green)" />
            <div className="small"><b>{perf?.goals ?? '-'}</b> เป้าหมาย (KPI/OKR)<div className="faint tiny mt8">อัปเดตจากระบบ Performance</div></div>
          </div>
          <div className="mt16"><div className="row between small"><span>ชั่วโมงเรียนรู้ปีนี้</span><b>{lnd?.hours || 0}/40</b></div><div className="mt8"><Bar value={(100 * (lnd?.hours || 0)) / 40} color="var(--green)" /></div></div>
        </div>
        <div className="card card-pad">
          <div className="card-title">แผนพัฒนารายบุคคล (IDP)</div>
          <div className="mt16" style={{ background: 'var(--green-50)', borderRadius: 14, padding: 14 }}>
            <div className="tiny faint">เป้าหมายการพัฒนา</div>
            <div className="bold mt8">{lnd?.idp_goal || 'ยังไม่มี IDP — คุยกับหัวหน้าเพื่อจัดทำ'}</div>
            {lnd?.idp_status && <div className="mt8"><Badge tone="green">{lnd.idp_status}</Badge></div>}
          </div>
          <div className="small bold mt16 mb8">หลักสูตรที่กำลังจะเรียน</div>
          {(lnd?.upcoming || []).map((u) => (
            <div key={u.title} className="row mb8"><Icon name="CalendarClock" size={16} color="var(--primary)" /><span className="small" style={{ flex: 1 }}>{u.title}</span><span className="tiny faint">{thDate(u.start_date)}</span></div>
          ))}
          {!lnd?.upcoming?.length && <p className="small faint">ไม่มีหลักสูตรที่ลงทะเบียนไว้</p>}
        </div>
        <div className="card card-pad">
          <div className="card-title mb16">เส้นทางอาชีพ (Career Path)</div>
          {LADDER.map((l, i) => {
            const n = i + 1; const cur = n === level
            return (
              <div key={l} className="row mb8" style={{ opacity: n > level + 1 ? 0.45 : 1 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: n <= level ? 'var(--primary)' : 'var(--surface-2)', color: n <= level ? '#fff' : 'var(--text-3)', border: n === level + 1 ? '2px dashed var(--primary)' : 'none' }}>{n}</div>
                <span className={`small ${cur ? 'bold' : ''}`}>{l}</span>
                {cur && <Badge tone="blue">ปัจจุบัน</Badge>}
                {n === level + 1 && <Badge tone="green">ขั้นถัดไป</Badge>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid g3 mt24">
        {[['Users', 'Mentoring Program', 'จับคู่พี่เลี้ยงข้ามสายงาน เรียนรู้จากประสบการณ์จริง', 'blue'], ['Repeat', 'Internal Job Posting', 'โอกาสย้ายงาน/เลื่อนตำแหน่งภายใน ก่อนเปิดรับภายนอก', 'violet'], ['Lightbulb', 'Knowledge Sharing', 'แบ่งปันความรู้ทุกวันศุกร์ รับคะแนน Recognition', 'amber']].map(([icon, t, s, th], i) => (
          <div key={t} className="card" style={{ overflow: 'hidden' }}>
            <Cover theme={th} height={90} icon={icon} variant={i} style={{ borderRadius: 0 }} />
            <div className="card-pad"><div className="bold">{t}</div><p className="small muted mt8">{s}</p><button className="btn btn-sm btn-soft mt12" onClick={() => app.toast('เปิดในระบบ L&D')}>ดูรายละเอียด</button></div>
          </div>
        ))}
      </div>
    </div>
  )
}
