import { useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { useApp } from '../lib/app'
import { useLoad } from '../lib/hooks'
import { list, rpc, update } from '../lib/api'
import { Logo } from '../components/Layout'
import { Badge, Field, Icon, Modal, PageHead, Tabs, ago } from '../components/ui'

const SYS = {
  HR_CORE: ['UserSquare2', '#3B5BFD', 'ข้อมูลพนักงาน'], PAYROLL: ['Receipt', '#14B8A6', 'เงินเดือน/สวัสดิการ'], TIME: ['AlarmClock', '#F59E0B', 'เวลาเข้า-ออกงาน'],
  RECRUIT: ['UserPlus', '#10B981', 'ผู้สมัคร/พนักงานใหม่'], LND: ['GraduationCap', '#8B5CF6', 'การพัฒนาและฝึกอบรม'], PERFORMANCE: ['Target', '#F97316', 'ผลการประเมิน']
}
const ST = { connected: ['เชื่อมต่อแล้ว', 'green'], pending: ['รอตั้งค่า', 'amber'], error: ['ผิดพลาด', 'red'], disabled: ['ปิดใช้งาน', 'gray'] }

export default function Settings() {
  const app = useApp()
  const [tab, setTab] = useState('integrations')
  const [edit, setEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [d, reload] = useLoad(async () => {
    const [ints, logs] = await Promise.all([list('er_integrations'), list('er_sync_logs', { order: 'started_at', limit: 8 })])
    return { ints, logs }
  }, [])
  const byCode = Object.fromEntries((d?.ints || []).map((i) => [i.system_code, i]))

  async function sync() {
    setBusy(true)
    try { const r = await rpc('er_sync_from_hrm'); app.toast(r?.error || `ซิงก์สำเร็จ · อัปเดต ${r.updated} รายการ`); reload(); app.reload() } catch (e) { app.toast(e.message) }
    setBusy(false)
  }
  async function saveValue(e) {
    e.preventDefault()
    const { id, ...patch } = edit
    await update('er_core_values', { id }, { ...patch, behaviors: String(patch.behaviors).split('\n').map((s) => s.trim()).filter(Boolean) })
    setEdit(null); app.toast('บันทึกค่านิยมแล้ว'); app.reload()
  }

  const Node = ({ code }) => {
    const i = byCode[code]; const [icon, color, th] = SYS[code]
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 14 }}>
        <div className="ico" style={{ margin: '0 auto', width: 48, height: 48, background: color + '18', color }}><Icon name={icon} size={22} /></div>
        <div className="bold small mt8 en">{i?.name.split(' (')[0] || code}</div>
        <div className="tiny faint">({th})</div>
        <div className="mt8"><Badge tone={ST[i?.status || 'pending'][1]}>{ST[i?.status || 'pending'][0]}</Badge></div>
      </div>
    )
  }

  return (
    <div>
      <PageHead eyebrow="ตั้งค่าระบบ" title="ตั้งค่า & การเชื่อมต่อระบบ HRM" sub="ข้อมูลพนักงานจากทุกระบบ เชื่อมต่อกันอย่างไร้รอยต่อ บนฐานข้อมูล Supabase" />
      <Tabs value={tab} onChange={setTab} items={[['integrations', 'การเชื่อมต่อ'], ['values', 'ค่านิยมองค์กร'], ['privacy', 'สิทธิ์ & ความเป็นส่วนตัว']]} />

      {tab === 'integrations' && (
        <>
          <div className="grid mt16" style={{ gridTemplateColumns: 'minmax(0,2.2fr) minmax(260px,1fr)' }}>
            <div className="card card-pad">
              <div className="card-title">เชื่อมโยงกับระบบ HRM อื่นๆ</div>
              <div className="small faint">ข้อมูลพนักงานจากทุกระบบ เชื่อมต่อกันอย่างไร้รอยต่อ</div>
              <div className="grid g3 mt16" style={{ gap: 12 }}>{['HR_CORE', 'PAYROLL', 'TIME'].map((c) => <Node key={c} code={c} />)}</div>
              <div className="hub-center my16" style={{ margin: '16px auto', maxWidth: 360 }}>
                <div className="row" style={{ justifyContent: 'center' }}><Logo size={42} /><div style={{ textAlign: 'left' }}><div className="brand-name">PeopleConnect</div><div className="tiny faint en">Employee Relation & Engagement</div></div></div>
              </div>
              <div className="grid g3" style={{ gap: 12 }}>{['RECRUIT', 'LND', 'PERFORMANCE'].map((c) => <Node key={c} code={c} />)}</div>
            </div>
            <div className="card card-pad" style={{ background: 'linear-gradient(160deg,#ecfdf5,#fff)' }}>
              <div className="ico" style={{ width: 60, height: 60, borderRadius: 18, background: '#10B981', color: '#fff', margin: '4px auto 0' }}><Icon name="Database" size={30} /></div>
              <div className="bold mt12" style={{ textAlign: 'center', fontSize: 22 }}>Supabase</div>
              <div className="small faint" style={{ textAlign: 'center' }}>{app.isDemo ? 'Demo mode (ยังไม่เชื่อมต่อ)' : 'เชื่อมต่อแล้ว'}</div>
              {['ฐานข้อมูลปลอดภัย (Row Level Security)', 'เชื่อถือได้และยืดหยุ่น (PostgreSQL)', 'รองรับการขยายตัว', 'เชื่อมต่อผ่าน API / Edge Functions', 'รองรับการทำงานแบบ Real-time'].map((t) => (
                <div key={t} className="row mt12 small"><Icon name="CheckCircle2" size={16} color="var(--green)" /> {t}</div>
              ))}
              <div className="hero-script mt16" style={{ fontSize: 26, color: 'var(--text-3)', textAlign: 'center' }}>Secure Data · Stronger People</div>
            </div>
          </div>

          <div className="card mt24 table-wrap">
            <table className="table">
              <thead><tr><th>ระบบ</th><th>ทิศทางข้อมูล</th><th>รายละเอียด</th><th>สถานะ</th><th>ซิงก์ล่าสุด</th><th>ระเบียน</th><th /></tr></thead>
              <tbody>{(d?.ints || []).map((i) => (
                <tr key={i.system_code}>
                  <td><div className="row"><div className="ico" style={{ width: 32, height: 32, background: SYS[i.system_code]?.[1] + '18', color: SYS[i.system_code]?.[1] }}><Icon name={SYS[i.system_code]?.[0]} size={16} /></div><span className="small bold">{i.name}</span></div></td>
                  <td><Badge tone="gray">{{ inbound: '← รับเข้า', outbound: 'ส่งออก →', both: '⇄ สองทาง' }[i.direction]}</Badge></td>
                  <td className="small muted" style={{ maxWidth: 320 }}>{i.description}</td>
                  <td><Badge tone={ST[i.status][1]}>{ST[i.status][0]}</Badge></td>
                  <td className="small">{i.last_sync_at ? ago(i.last_sync_at) : '-'}</td>
                  <td className="small">{i.records?.toLocaleString()}</td>
                  <td>{i.system_code === 'HR_CORE' && <button className="btn btn-sm btn-soft" onClick={sync} disabled={busy}><RefreshCw size={13} /> ซิงก์</button>}</td>
                </tr>))}</tbody>
            </table>
          </div>

          <div className="card card-pad mt24">
            <div className="card-title mb16">ประวัติการซิงก์</div>
            {(d?.logs || []).map((l) => (
              <div key={l.id} className="row small mb8"><Icon name="CheckCircle2" size={15} color={l.status === 'success' ? 'var(--green)' : 'var(--red)'} /><span className="en bold">{l.system_code}</span><span className="muted">{l.message}</span><span className="faint" style={{ marginLeft: 'auto' }}>+{l.inserted} / ~{l.updated} · {ago(l.started_at)}</span></div>
            ))}
          </div>
        </>
      )}

      {tab === 'values' && (
        <div className="grid g3 mt16">
          {app.coreValues.map((v) => (
            <div key={v.id} className="card card-pad" style={{ borderTop: `4px solid ${v.color}` }}>
              <div className="row between"><div className="row"><div className="ico" style={{ background: v.color + '18', color: v.color }}><Icon name={v.icon} /></div><div><div className="bold">{v.name_th}</div><div className="tiny faint en">{v.name_en} · {v.code}</div></div></div>
                <button className="btn btn-sm btn-ghost" onClick={() => setEdit({ id: v.id, name_th: v.name_th, name_en: v.name_en, description: v.description, behaviors: (v.behaviors || []).join('\n'), color: v.color, icon: v.icon })}>แก้ไข</button></div>
              <p className="small muted mt12">{v.description}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'privacy' && (
        <div className="grid g2 mt16">
          {[
            ['Lock', 'แบบสำรวจนิรนาม', 'แยกตาราง participation (ใครตอบ) ออกจาก responses (คำตอบ) · HR อ่านผลได้ผ่าน RPC แบบรวมเท่านั้น · กลุ่มที่มีผู้ตอบ < 5 คนจะถูกซ่อน'],
            ['ShieldCheck', 'ER Case เป็นความลับ', 'เข้าถึงได้เฉพาะ admin / hr / er_officer · ผู้ร้องเห็นเฉพาะสถานะเคสของตน · บันทึกทุกการเปลี่ยนแปลง'],
            ['HeartPulse', 'Wellbeing Check-in', 'ข้อมูลอารมณ์/ความเครียดเห็นได้เฉพาะเจ้าของ · HR เห็นค่าเฉลี่ยรายสัปดาห์ที่มี ≥ 5 คน'],
            ['Users', 'สิทธิ์ผู้ใช้', 'ใช้บทบาท admin/hr ร่วมกับระบบ L&D (hrd_user_roles) และ HR Portal (plfl_profile) · หัวหน้างานเห็นข้อมูล Journey ของลูกทีมตามสายบังคับบัญชาจาก HR Core'],
            ['EyeOff', 'Feedback ไม่ระบุตัวตน', 'ไม่บันทึก employee_id · ใช้รหัสติดตาม (ref code) เพื่อดูสถานะ'],
            ['FileCheck2', 'PDPA', 'เก็บเฉพาะข้อมูลที่จำเป็น · ข้อมูลอ่อนไหว (เงินเดือน/บัตรประชาชน) อยู่ในระบบต้นทาง ไม่คัดลอกมาที่ ER']
          ].map(([icon, t, s]) => (
            <div key={t} className="card card-pad row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <div className="ico" style={{ background: 'var(--violet-50)', color: 'var(--violet)' }}><Icon name={icon} /></div>
              <div><div className="bold">{t}</div><p className="small muted mt8">{s}</p></div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="แก้ไขค่านิยม">
        {edit && (
          <form onSubmit={saveValue}>
            <div className="grid g2" style={{ gap: 12 }}>
              <Field label="ชื่อ (ไทย)"><input className="input" value={edit.name_th} onChange={(e) => setEdit({ ...edit, name_th: e.target.value })} /></Field>
              <Field label="ชื่อ (อังกฤษ)"><input className="input" value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></Field>
              <Field label="สี"><input className="input" type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ height: 42 }} /></Field>
              <Field label="ไอคอน (lucide)"><input className="input" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></Field>
            </div>
            <Field label="คำอธิบาย"><textarea className="textarea" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="พฤติกรรมที่คาดหวัง (บรรทัดละ 1 ข้อ)"><textarea className="textarea" value={edit.behaviors} onChange={(e) => setEdit({ ...edit, behaviors: e.target.value })} /></Field>
            <button className="btn btn-primary btn-block"><Save size={15} /> บันทึก</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
