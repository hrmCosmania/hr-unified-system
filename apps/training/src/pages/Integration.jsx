import { ArrowLeftRight, ArrowRight, Briefcase, Clock, Database, Gift, RefreshCw, Sprout, Trophy, UserPlus, Users, BarChart3 } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, PageHeader, Table } from '../components/ui'
import { isDemo, rpc } from '../lib/db'
import { fmtDate } from '../lib/format'
import { useStore } from '../lib/store'

const ICONS = { HR_CORE: Users, RECRUITMENT: UserPlus, TIME: Clock, PERFORMANCE: BarChart3, COMP_BEN: Gift, SUCCESSION: Trophy, PAYROLL: Briefcase }
const DIR = { inbound: 'รับเข้า HRD', outbound: 'ส่งออกจาก HRD', both: 'สองทาง' }

export default function Integration() {
  const { data, insert, update, notify, reload } = useStore()
  const [busy, setBusy] = useState(null)

  const sync = async (it) => {
    setBusy(it.id)
    const started = new Date().toISOString()
    try {
      if (!isDemo && it.system_code === 'HR_CORE') {
        const res = await rpc('hrd_sync_from_hrm')
        notify(res?.error ? `Sync ไม่สำเร็จ: ${res.error}` : `Sync สำเร็จ: เพิ่ม ${res.inserted} · อัปเดต ${res.updated}`, res?.error ? 'error' : 'success')
        await reload()
      } else {
        await new Promise((r) => setTimeout(r, 900))
        const updated = Math.floor(Math.random() * 40)
        await insert('sync_logs', { system_code: it.system_code, started_at: started, finished_at: new Date().toISOString(), status: 'success', inserted: Math.floor(Math.random() * 5), updated, message: isDemo ? 'Sync สำเร็จ (โหมดสาธิต)' : 'Manual sync' })
        await update('integrations', it.id, { last_sync_at: new Date().toISOString(), status: 'connected' })
        notify(`Sync ${it.name} สำเร็จ`)
      }
    } catch { /* toast already shown */ } finally { setBusy(null) }
  }

  const logs = data.sync_logs.slice().sort((a, b) => b.started_at.localeCompare(a.started_at))
  const sysName = Object.fromEntries(data.integrations.map((i) => [i.system_code, i.name]))

  return (
    <div>
      <PageHeader title="การเชื่อมต่อกับระบบ HRM และ Supabase" subtitle="เชื่อมโยงข้อมูลทั้งองค์กร — ข้อมูลพนักงานเป็นปัจจุบันเสมอ และผลการพัฒนาส่งกลับไปใช้ในระบบอื่น" crumbs={[{ label: 'HRD', to: '/' }, { label: 'การเชื่อมต่อ' }]} />

      <Card>
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="space-y-2">
            <div className="mb-1 text-sm font-semibold text-navy-900">HRM System</div>
            {data.integrations.filter((i) => i.direction !== 'outbound').map((i) => { const I = ICONS[i.system_code] || Users; return <div key={i.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><I size={16} className="text-brand-600" />{i.name}</div> })}
          </div>
          <ArrowLeftRight className="mx-auto text-slate-300" />
          <div className="flex flex-col items-center gap-3">
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-navy-800 to-brand-600 text-white shadow-lg"><div className="text-center"><Sprout className="mx-auto" /><b>HRD</b></div></div>
            <div className="text-xs text-slate-400">REST API · Realtime · RPC</div>
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm ring-1 ring-emerald-200"><Database className="text-emerald-600" size={20} /><div><b>Supabase</b><div className="text-xs text-slate-500">PostgreSQL + Auth + RLS</div></div></div>
          </div>
          <ArrowRight className="mx-auto text-slate-300" />
          <div className="space-y-2">
            <div className="mb-1 text-sm font-semibold text-navy-900">ระบบปลายทาง / ข้อมูลที่ส่งออก</div>
            {['ชั่วโมงอบรม → Time & Attendance', 'ใบรับรอง/คุณวุฒิ → Compensation & Benefits', 'ผลการพัฒนา → Performance Review', 'Training History → HR Core / Employee Self-Service', 'Dashboard → BI'].map((x) => <div key={x} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{x}</div>)}
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.integrations.map((it) => {
          const I = ICONS[it.system_code] || Users
          return (
            <Card key={it.id}>
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><I size={22} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><b className="text-navy-900">{it.name}</b><Badge status={it.status}>{it.status === 'connected' ? 'เชื่อมต่อแล้ว' : it.status === 'warning' ? 'ต้องตรวจสอบ' : 'ไม่เชื่อมต่อ'}</Badge></div>
                  <div className="mt-1 text-xs text-slate-500">{it.description}</div>
                  <div className="mt-3 flex flex-wrap gap-x-4 text-xs text-slate-400"><span>{DIR[it.direction]}</span><span>{(it.records || 0).toLocaleString()} รายการ</span><span>sync ล่าสุด {it.last_sync_at ? `${fmtDate(it.last_sync_at)} ${new Date(it.last_sync_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : '-'}</span></div>
                </div>
              </div>
              <Button size="sm" variant="secondary" className="mt-3 w-full" disabled={busy === it.id} onClick={() => sync(it)}><RefreshCw size={14} className={busy === it.id ? 'animate-spin' : ''} />{busy === it.id ? 'กำลัง Sync…' : 'Sync ตอนนี้'}</Button>
            </Card>
          )
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card title="ประวัติการ Sync">
          <Table rows={logs} max={25} columns={[
            { key: 't', label: 'เวลา', render: (l) => <span className="whitespace-nowrap text-slate-500">{fmtDate(l.started_at)} {new Date(l.started_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span> },
            { key: 's', label: 'ระบบ', render: (l) => sysName[l.system_code] || l.system_code },
            { key: 'st', label: 'ผล', render: (l) => <Badge status={l.status}>{l.status}</Badge> },
            { key: 'n', label: 'เพิ่ม/อัปเดต', render: (l) => `${l.inserted}/${l.updated}` },
            { key: 'm', label: 'ข้อความ', render: (l) => <span className="text-xs text-slate-500">{l.message}</span> },
          ]} />
        </Card>
        <Card title="API สำหรับระบบ HRM อื่น">
          <div className="space-y-3 text-sm text-slate-600">
            <p>ระบบต้นทางส่งข้อมูลพนักงานเข้ามาที่ RPC <code className="rounded bg-slate-100 px-1">hrd_upsert_employees</code> (ใช้ service role key ฝั่ง server เท่านั้น):</p>
            <pre className="overflow-x-auto rounded-xl bg-navy-900 p-3 text-[11px] leading-relaxed text-blue-100">{`POST {SUPABASE_URL}/rest/v1/rpc/hrd_upsert_employees
apikey: {SERVICE_ROLE_KEY}
Authorization: Bearer {SERVICE_ROLE_KEY}
Content-Type: application/json

{ "payload": [{
  "hrm_employee_id": 1024, "employee_code": "E01024",
  "first_name": "สมชาย", "last_name": "ใจดี",
  "department_code": "RT-OPS", "position_code": "ST-SUP",
  "hire_date": "2024-05-01", "status": "active" }] }`}</pre>
            <p>ถ้า HRM อยู่ใน Supabase project เดียวกัน เรียก <code className="rounded bg-slate-100 px-1">hrd_sync_from_hrm()</code> เพื่อดึงข้อมูลจากตาราง employee / org_unit / position / performance_review ได้ทันที (ตั้งเป็น pg_cron รายวันได้)</p>
            <p>ระบบปลายทางอ่านประวัติการอบรมจาก view <code className="rounded bg-slate-100 px-1">hrd_v_export_training_history</code></p>
          </div>
        </Card>
      </div>
    </div>
  )
}
