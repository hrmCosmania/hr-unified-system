import { Factory, Lock, Mail, ShoppingCart, Sprout, Store, Zap } from 'lucide-react'
import { useState } from 'react'
import { Button, cx } from '../components/ui'
import { LABELS } from '../lib/format'
import { useStore } from '../lib/store'

export default function Login() {
  const { signIn, isDemo } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('admin')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try { await signIn({ email, password, demoRole: role }) } catch (ex) { setErr(ex.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : ex.message) } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.2fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-brand-600 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Sprout className="text-emerald-300" size={28} /></div>
          <div><div className="text-2xl font-bold">PeopleGrow</div><div className="text-sm text-blue-200">Grow Together for a Brighter Tomorrow</div></div>
        </div>
        <div className="mt-auto max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">พัฒนาศักยภาพคน<br />สู่ความสำเร็จขององค์กร</h1>
          <p className="mt-4 text-lg text-blue-100">ระบบบริหารและพัฒนาบุคลากร (HRD) ครบวงจร สำหรับธุรกิจค้าปลีก FMCG และโรงงาน — ตั้งแต่วันแรกที่เข้างาน จนถึงการเติบโตในสายอาชีพ</p>
          <div className="mt-8 flex gap-8">
            {[[ShoppingCart, 'Retail'], [Store, 'FMCG'], [Factory, 'Factory']].map(([I, l]) => (
              <div key={l} className="flex flex-col items-center gap-2"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><I size={26} /></div><span className="text-sm">{l}</span></div>
            ))}
          </div>
        </div>
        <div className="mt-12 text-sm text-blue-200">Learn • Develop • Advance • Together</div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 right-24 h-80 w-80 rounded-full bg-emerald-400/10" />
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-navy-900">เข้าสู่ระบบ</h2>
          <p className="mb-6 text-sm text-slate-500">HRD Learning & Development</p>

          {isDemo ? (
            <>
              <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <b>โหมดสาธิต</b> — ยังไม่ได้ตั้งค่า Supabase ระบบจะใช้ข้อมูลตัวอย่าง เลือกมุมมองผู้ใช้งานเพื่อทดลองใช้
              </div>
              <div className="mb-5 space-y-2">
                {['admin', 'manager', 'employee'].map((r) => (
                  <label key={r} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition', role === r ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="accent-brand-600" />
                    <div><div className="font-medium">{LABELS.role[r]}</div>
                      <div className="text-xs text-slate-500">{r === 'admin' ? 'เห็นภาพรวมทั้งองค์กร จัดการหลักสูตร รายงาน และการเชื่อมต่อ' : r === 'manager' ? 'อนุมัติการอบรม ดู IDP และ Talent ของทีม' : 'เรียนรู้ ลงทะเบียน วางแผน IDP และเส้นทางอาชีพของตนเอง'}</div></div>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="mb-5 space-y-3">
              <div className="relative"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500" /></div>
              <div className="relative"><Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500" /></div>
            </div>
          )}
          {err && <div className="mb-3 text-sm text-rose-600">{err}</div>}
          <Button className="w-full py-2.5" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</Button>
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-400">Powered by <Zap size={14} className="fill-emerald-500 text-emerald-500" /> <b className="text-slate-600">Supabase</b></div>
        </form>
      </div>
    </div>
  )
}
