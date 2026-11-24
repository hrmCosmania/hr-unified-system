import {
  Award, BookOpen, CalendarDays, ChevronRight, ClipboardList, Clock, Database, Factory, FileCheck2, GraduationCap,
  ShoppingCart, Store, Target, TrendingUp, Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Card, Stat } from '../components/ui'
import { expiringCerts, monthlyStats } from '../lib/analytics'
import { CURRENT_YEAR, fmtDate, fmtNum, fmtRange, LABELS, pct, thMonth, TODAY } from '../lib/format'
import { useStore } from '../lib/store'
import MyLearning from './MyLearning'

export default function Dashboard() {
  const { me, isManager } = useStore()
  if (!isManager) return <MyLearning welcome />
  return <OrgDashboard me={me} />
}

function OrgDashboard({ me }) {
  const { data, idx, visibleEmpIds, isHR } = useStore()
  const nav = useNavigate()

  const s = useMemo(() => {
    const emps = data.employees.filter((e) => visibleEmpIds.has(e.id) && e.status !== 'resigned')
    const empSet = new Set(emps.map((e) => e.id))
    const ensYear = data.enrollments.filter((e) => empSet.has(e.employee_id) && new Date(idx.session[e.session_id]?.start_date).getFullYear() === CURRENT_YEAR)
    const done = ensYear.filter((e) => ['completed', 'attended', 'failed'].includes(e.status))
    const trained = new Set(done.map((e) => e.employee_id))
    const hours = done.reduce((x, e) => x + Number(e.attended_hours || 0), 0)
    const pendingApprove = data.enrollments.filter((e) => e.status === 'requested' && (isHR ? empSet.has(e.employee_id) : idx.emp[e.employee_id]?.manager_id === me.employee?.id)).length
    const pendingEval = data.enrollments.filter((e) => e.status === 'completed' && e.behavior_score == null && empSet.has(e.employee_id) && new Date(idx.session[e.session_id].end_date).getFullYear() === CURRENT_YEAR).length
    const idpPending = data.idps.filter((i) => i.status === 'submitted' && empSet.has(i.employee_id)).length
    const idpOverdue = data.idp_items.filter((it) => it.status === 'overdue' && empSet.has(idx.idp[it.idp_id]?.employee_id)).length
    const expiring = expiringCerts(data, 60).filter((c) => empSet.has(c.employee_id)).length
    const plannedNext = data.training_sessions.filter((x) => x.status === 'planned').length

    const popular = data.courses.map((c) => {
      const n = (idx.sessionsByCourse[c.id] || []).reduce((a, ss) => a + (idx.enrollBySession[ss.id] || []).filter((e) => empSet.has(e.employee_id)).length, 0)
      return { c, n }
    }).sort((a, b) => b.n - a.n).slice(0, 4)

    const upcoming = data.training_sessions.filter((x) => new Date(x.start_date) >= TODAY && x.status !== 'cancelled').sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 4)
    const byBU = data.business_units.map((b) => {
      const list = emps.filter((e) => e.business_unit_id === b.id)
      return { b, total: list.length, trained: list.filter((e) => trained.has(e.id)).length }
    })
    return { emps, trained, hours, pendingApprove, pendingEval, idpPending, idpOverdue, expiring, plannedNext, popular, upcoming, byBU }
  }, [data, idx, visibleEmpIds, isHR, me])

  const chart = monthlyStats(data, idx).slice(0, 12).map((m) => ({ name: thMonth(m.month), ผู้เข้าอบรม: m.trainees, ชั่วโมงอบรม: Math.round(m.hours / 10) }))
  const tasks = [
    { icon: ClipboardList, label: 'อนุมัติการลงทะเบียนอบรม', n: s.pendingApprove, to: '/training?tab=approve', c: 'bg-rose-50 text-rose-600' },
    { icon: FileCheck2, label: 'ประเมินผลหลังอบรม (L3)', n: s.pendingEval, to: '/training?tab=evaluate', c: 'bg-amber-50 text-amber-600' },
    { icon: Target, label: 'อนุมัติแผนพัฒนารายบุคคล (IDP)', n: s.idpPending, to: '/idp?status=submitted', c: 'bg-emerald-50 text-emerald-600' },
    { icon: Clock, label: 'กิจกรรม IDP เลยกำหนด', n: s.idpOverdue, to: '/idp?status=overdue', c: 'bg-orange-50 text-orange-600' },
    { icon: Award, label: 'ใบรับรองใกล้หมดอายุ (60 วัน)', n: s.expiring, to: '/training?tab=certs', c: 'bg-blue-50 text-blue-600' },
  ]

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-50 via-white to-emerald-50 p-6 ring-1 ring-slate-100 lg:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="text-sm text-slate-500">สวัสดี, คุณ{me.employee?.first_name} 👋</div>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-navy-900">พัฒนาศักยภาพคน<br className="hidden sm:block" /> สู่ความสำเร็จขององค์กร</h1>
          <p className="mt-2 text-slate-500">{isHR ? 'ภาพรวมการพัฒนาบุคลากรทั้งองค์กร' : 'ภาพรวมการพัฒนาบุคลากรในทีมของคุณ'} ประจำปี {CURRENT_YEAR + 543} — ธุรกิจค้าปลีก FMCG และโรงงาน</p>
          <div className="mt-5 flex gap-6">
            {[[ShoppingCart, 'Retail'], [Store, 'FMCG'], [Factory, 'Factory']].map(([I, l]) => (
              <div key={l} className="flex items-center gap-2 text-sm text-navy-800"><I size={20} className="text-brand-600" />{l}</div>
            ))}
          </div>
        </div>
        <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 rotate-[-6deg] text-right font-serif text-3xl italic leading-snug text-navy-800/70 xl:block">People<br />Make<br />Progress</div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label={isHR ? 'พนักงานทั้งหมด' : 'พนักงานในทีม'} value={fmtNum(s.emps.length)} unit="คน" tone="blue" />
        <Stat icon={GraduationCap} label={`อบรมแล้ว (ปี ${CURRENT_YEAR + 543})`} value={fmtNum(s.trained.size)} unit="คน" sub={`${pct(s.trained.size, s.emps.length)}% ของพนักงาน`} tone="green" />
        <Stat icon={BookOpen} label="หลักสูตรทั้งหมด" value={fmtNum(data.courses.filter((c) => c.status === 'published').length)} unit="หลักสูตร" sub={`${data.training_sessions.length} รุ่นอบรม`} tone="amber" />
        <Stat icon={TrendingUp} label="ชั่วโมงอบรมรวม" value={fmtNum(s.hours)} unit="ชม." sub={`เฉลี่ย ${fmtNum(s.hours / Math.max(1, s.emps.length), 1)} ชม./คน`} tone="violet" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="กิจกรรมที่ต้องดำเนินการ">
          <div className="space-y-2">
            {tasks.map((t) => (
              <Link key={t.label} to={t.to} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.c}`}><t.icon size={19} /></div>
                <span className="flex-1 text-sm">{t.label}</span>
                <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold ${t.n ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{t.n}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="สถิติการพัฒนาบุคลากรรายเดือน" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ left: -10, right: 10 }}>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v, n) => (n === 'ชั่วโมงอบรม' ? [`${fmtNum(v * 10)} ชม.`, n] : [`${fmtNum(v)} คน`, n])} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ผู้เข้าอบรม" fill="#5b8def" radius={[6, 6, 0, 0]} barSize={22} />
                <Line dataKey="ชั่วโมงอบรม" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {s.byBU.map(({ b, total, trained }) => (
              <div key={b.id} className="rounded-xl bg-slate-50 p-3">
                <div className="truncate text-xs text-slate-500">{b.name}</div>
                <div className="text-lg font-bold text-navy-900">{pct(trained, total)}%</div>
                <div className="text-[11px] text-slate-400">อบรมแล้ว {fmtNum(trained)}/{fmtNum(total)} คน</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="หลักสูตรยอดนิยม" action={<Link to="/courses" className="text-sm text-brand-600">ดูทั้งหมด</Link>}>
          <div className="space-y-3">
            {s.popular.map(({ c, n }) => (
              <Link key={c.id} to={`/courses/${c.id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-slate-50">
                <CourseThumb course={c} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{c.title}</div><div className="text-xs text-slate-400">{c.category} · {fmtNum(n)} คน</div></div>
              </Link>
            ))}
          </div>
        </Card>
        <Card title="รุ่นอบรมที่กำลังจะมาถึง" action={isHR && <Link to="/training" className="text-sm text-brand-600">จัดการ</Link>}>
          <div className="space-y-3">
            {s.upcoming.map((x) => {
              const c = idx.course[x.course_id]
              const n = (idx.enrollBySession[x.id] || []).filter((e) => !['rejected'].includes(e.status)).length
              return (
                <button key={x.id} onClick={() => nav(`/training/sessions/${x.id}`)} className="flex w-full items-center gap-3 rounded-xl p-1 text-left hover:bg-slate-50">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-center leading-tight text-brand-700">
                    <div><div className="text-lg font-bold">{new Date(x.start_date).getDate()}</div><div className="text-[10px]">{thMonth(new Date(x.start_date).getMonth())}</div></div>
                  </div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{c.title}</div><div className="text-xs text-slate-400">รุ่นที่ {x.batch_no} · {n}/{x.capacity} คน</div></div>
                  <Badge status={x.status}>{LABELS.sessionStatus[x.status]}</Badge>
                </button>
              )
            })}
          </div>
        </Card>
        <Card title="ประกาศ / ข่าวสาร">
          <div className="space-y-3">
            {data.announcements.slice().sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 4).map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><CalendarDays size={17} /></div>
                <div><div className="text-sm font-medium leading-snug">{a.title}</div><div className="text-xs text-slate-400">{fmtDate(a.published_at)}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {isHR && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Card title="เชื่อมโยงกับระบบ HRM อื่นๆ" action={<Link to="/integration" className="text-sm text-brand-600">รายละเอียด</Link>}>
            <div className="flex flex-wrap items-center gap-2">
              {data.integrations.map((it, i) => (
                <div key={it.id} className="flex items-center gap-2">
                  <div className="w-28 rounded-xl bg-slate-50 p-2.5 text-center">
                    <div className="truncate text-xs font-semibold text-navy-900">{it.name}</div>
                    <Badge status={it.status} className="mt-1">{it.status === 'connected' ? 'เชื่อมต่อแล้ว' : 'ตรวจสอบ'}</Badge>
                  </div>
                  {i < data.integrations.length - 1 && <ChevronRight size={16} className="text-slate-300" />}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Database size={28} /></div>
              <div>
                <div className="text-lg font-bold text-navy-900">Supabase</div>
                <div className="text-xs text-slate-500">Secure • Scalable • Real-time</div>
              </div>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm text-slate-600">
              <li>✓ เก็บข้อมูลบน Cloud</li><li>✓ Row Level Security</li><li>✓ รองรับองค์กรขนาดใหญ่</li><li>✓ เชื่อมต่อผ่าน REST API</li>
            </ul>
            <div className="mt-2 text-xs text-slate-400">แผนอบรมรอเปิดรุ่น {s.plannedNext} รุ่น</div>
          </Card>
        </div>
      )}
    </div>
  )
}

export function CourseThumb({ course, size = 48 }) {
  const colors = { Leadership: 'from-blue-500 to-indigo-600', Functional: 'from-teal-400 to-emerald-600', 'Soft Skill': 'from-violet-400 to-purple-600', Safety: 'from-amber-400 to-orange-500', Compliance: 'from-rose-400 to-red-500', Digital: 'from-sky-400 to-cyan-600' }
  return (
    <div className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${colors[course.category] || 'from-slate-400 to-slate-600'}`} style={{ width: size, height: size }}>
      <span className="text-[11px] font-bold">{course.code.split('-')[0]}</span>
    </div>
  )
}
