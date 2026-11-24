import { Database, Plus, RotateCcw, Upload } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table } from '../components/ui'
import { isDemo, pushSeedToSupabase, resetDemo } from '../lib/db'
import { CURRENT_YEAR, fmtBaht, fmtDate, fullName, LABELS } from '../lib/format'
import { useStore } from '../lib/store'

export default function Settings() {
  const { data, idx, update, insert, remove, notify, reload, me } = useStore()
  const [progress, setProgress] = useState('')
  const [role, setRole] = useState({ auth_user_id: '', role: 'hr' })
  const [link, setLink] = useState({ employee_code: '', auth_user_id: '' })
  const [ann, setAnn] = useState({ title: '', body: '' })

  const push = async () => {
    if (!confirm('นำเข้าคลังหลักสูตร สมรรถนะ และวิทยากรตัวอย่าง (ไม่มีข้อมูลพนักงาน) เพื่อเป็นจุดเริ่มต้น แล้วแก้ไขให้ตรงกับบริษัทภายหลัง?')) return
    try { await pushSeedToSupabase(setProgress); setProgress('เสร็จสิ้น'); await reload() } catch (e) { setProgress(`ผิดพลาด: ${e.message}`) }
  }

  return (
    <div>
      <PageHeader title="ตั้งค่าระบบ" subtitle="การเชื่อมต่อฐานข้อมูล สิทธิ์ผู้ใช้งาน งบประมาณ และประกาศ" crumbs={[{ label: 'HRD', to: '/' }, { label: 'ตั้งค่าระบบ' }]} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="ฐานข้อมูล">
          <div className="flex items-center gap-3">
            <Database className={isDemo ? 'text-amber-500' : 'text-emerald-600'} />
            <div><b>{isDemo ? 'โหมดสาธิต (ข้อมูลตัวอย่างใน Browser)' : 'เชื่อมต่อ Supabase แล้ว'}</b>
              <div className="text-xs text-slate-500">{isDemo ? 'ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในไฟล์ .env เพื่อใช้งานจริง' : import.meta.env.VITE_SUPABASE_URL}</div></div>
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            {[['พนักงาน', data.employees.length], ['หลักสูตร', data.courses.length], ['รุ่นอบรม', data.training_sessions.length], ['การลงทะเบียน', data.enrollments.length], ['ใบประกาศ', data.certificates.length], ['IDP', data.idps.length]].map(([l, n]) => (
              <div key={l} className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-xs text-slate-400">{l}</div><b>{n.toLocaleString()}</b></div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {isDemo
              ? <Button variant="secondary" onClick={() => { if (confirm('ล้างการเปลี่ยนแปลงทั้งหมดในโหมดสาธิต?')) { resetDemo(); reload(); notify('รีเซ็ตข้อมูลสาธิตแล้ว') } }}><RotateCcw size={15} />รีเซ็ตข้อมูลสาธิต</Button>
              : <Button variant="secondary" onClick={push} disabled={data.courses.length > 0 || data.competencies.length > 0} title={data.courses.length > 0 ? 'มีหลักสูตรในระบบแล้ว' : ''}><Upload size={15} />นำเข้าคลังหลักสูตรและสมรรถนะตัวอย่าง</Button>}
          </div>
          {progress && <div className="mt-2 text-xs text-slate-500">{progress}</div>}
        </Card>

        <Card title="สิทธิ์ผู้ใช้งาน (Role)">
          <p className="mb-3 text-sm text-slate-500">ผู้ใช้ที่ไม่ได้กำหนดสิทธิ์จะเป็น “พนักงาน” · หัวหน้างานเห็นข้อมูลทีมตามสายบังคับบัญชาจาก HR Core</p>
          {isDemo ? <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">ผู้ใช้ปัจจุบัน: {fullName(me.employee)} — {LABELS.role[me.role]} (สลับมุมมองได้จากเมนูโปรไฟล์)</div> : (
            <>
              <Table rows={data.user_roles.map((r) => ({ ...r, id: r.auth_user_id }))} empty="ยังไม่มีการกำหนดสิทธิ์" columns={[
                { key: 'u', label: 'Auth User ID', render: (r) => <code className="text-xs">{r.auth_user_id}</code> },
                { key: 'e', label: 'พนักงาน', render: (r) => fullName(data.employees.find((e) => e.auth_user_id === r.auth_user_id)) },
                { key: 'r', label: 'สิทธิ์', render: (r) => <Badge tone="blue">{LABELS.role[r.role]}</Badge> },
              ]} />
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1"><Field label="Auth User ID (จาก Supabase Auth)"><Input value={role.auth_user_id} onChange={(e) => setRole({ ...role, auth_user_id: e.target.value })} /></Field></div>
                <div className="w-44"><Select value={role.role} onChange={(e) => setRole({ ...role, role: e.target.value })} options={Object.entries(LABELS.role).map(([value, label]) => ({ value, label }))} /></div>
                <Button onClick={async () => { await insert('user_roles', role); notify('กำหนดสิทธิ์แล้ว') }}><Plus size={15} />เพิ่ม</Button>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
                <div className="w-40"><Field label="รหัสพนักงาน"><Input value={link.employee_code} onChange={(e) => setLink({ ...link, employee_code: e.target.value })} /></Field></div>
                <div className="min-w-56 flex-1"><Field label="ผูกกับ Auth User ID"><Input value={link.auth_user_id} onChange={(e) => setLink({ ...link, auth_user_id: e.target.value })} /></Field></div>
                <Button variant="secondary" onClick={async () => {
                  const emp = data.employees.find((e) => e.employee_code === link.employee_code)
                  if (!emp) return notify('ไม่พบรหัสพนักงาน', 'error')
                  await update('employees', emp.id, { auth_user_id: link.auth_user_id }); notify('ผูกบัญชีแล้ว')
                }}>ผูกบัญชี</Button>
              </div>
            </>
          )}
        </Card>

        <Card title={`งบประมาณการพัฒนาบุคลากร ปี ${CURRENT_YEAR + 543}`}>
          <Table rows={data.training_budgets.filter((b) => b.year === CURRENT_YEAR)} columns={[
            { key: 'b', label: 'สายธุรกิจ', render: (b) => idx.bu[b.business_unit_id]?.name },
            { key: 'v', label: 'งบประมาณ', render: (b) => fmtBaht(b.budget) },
            { key: 'e', label: 'แก้ไข', render: (b) => <input type="number" defaultValue={b.budget} onBlur={(e) => Number(e.target.value) !== Number(b.budget) && update('training_budgets', b.id, { budget: Number(e.target.value) }).then(() => notify('บันทึกงบประมาณแล้ว'))} className="w-36 rounded-md border border-slate-200 px-2 py-1 text-sm" /> },
          ]} />
        </Card>

        <Card title="ประกาศ / ข่าวสาร">
          <div className="space-y-2">
            {data.announcements.slice().sort((a, b) => b.published_at.localeCompare(a.published_at)).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 border-b border-slate-50 pb-2">
                <div><div className="text-sm font-medium">{a.title}</div><div className="text-xs text-slate-400">{fmtDate(a.published_at)}</div></div>
                <button className="text-xs text-rose-500" onClick={() => remove('announcements', a.id)}>ลบ</button>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Input placeholder="หัวข้อประกาศ" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
            <Input placeholder="รายละเอียด" value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
            <Button size="sm" onClick={async () => { if (!ann.title) return; await insert('announcements', { ...ann, category: 'news', published_at: new Date().toISOString().slice(0, 10) }); setAnn({ title: '', body: '' }); notify('เผยแพร่ประกาศแล้ว') }}><Plus size={14} />เผยแพร่</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
