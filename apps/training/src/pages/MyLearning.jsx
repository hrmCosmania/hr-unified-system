import { Award, BarChart3, BookOpen, CalendarDays, Layers, Sparkles, Target, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import CertificateModal from '../components/Certificate'
import { Badge, Button, Card, Empty, PageHeader, Progress, Table, Tabs } from '../components/ui'
import { employeeHours, idpProgress, recommendCourses } from '../lib/analytics'
import { CURRENT_YEAR, fmtDate, fmtRange, LABELS, TODAY, yearsBetween } from '../lib/format'
import { useStore } from '../lib/store'
import { CourseThumb } from './Dashboard'

export default function MyLearning({ welcome }) {
  const { me, data, idx } = useStore()
  const [tab, setTab] = useState('active')
  const [cert, setCert] = useState(null)
  const emp = me.employee
  if (!emp) return <Empty title="บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน">ติดต่อ HR เพื่อเชื่อมบัญชีผู้ใช้กับรหัสพนักงาน</Empty>

  const ens = (idx.enrollByEmp[emp.id] || []).map((e) => ({ ...e, s: idx.session[e.session_id], c: idx.course[idx.session[e.session_id]?.course_id] })).filter((e) => e.s && e.c)
  const active = ens.filter((e) => ['requested', 'approved'].includes(e.status)).sort((a, b) => a.s.start_date.localeCompare(b.s.start_date))
  const history = ens.filter((e) => !['requested', 'approved'].includes(e.status)).sort((a, b) => b.s.start_date.localeCompare(a.s.start_date))
  const upcoming = active.filter((e) => new Date(e.s.start_date) >= TODAY)
  const inProgress = active.filter((e) => new Date(e.s.start_date) < TODAY)
  const certs = idx.certByEmp[emp.id] || []
  const idp = idx.idpByEmp[emp.id]
  const recs = recommendCourses(data, idx, emp.id, 4)
  const hours = employeeHours(idx, emp.id)
  const mandatory = data.courses.filter((c) => c.is_mandatory && (!c.target_bu?.length || c.target_bu.includes(idx.bu[emp.business_unit_id]?.code))
    && (!c.code.startsWith('ORI') || yearsBetween(emp.hire_date) < 1))
  const doneIds = new Set(history.filter((e) => e.status === 'completed').map((e) => e.c.id))

  const quick = [
    { to: '/courses', icon: Layers, label: 'Course Catalog' },
    { to: '/idp', icon: Target, label: 'Development Plan' },
    { to: '/career', icon: TrendingUp, label: 'เส้นทางอาชีพ' },
    { to: '/competency', icon: BarChart3, label: 'สมรรถนะของฉัน' },
    { to: `/employees/${emp.id}`, icon: BookOpen, label: 'โปรไฟล์ของฉัน' },
  ]

  return (
    <div className="space-y-5">
      {welcome ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-800 to-brand-600 p-7 text-white">
          <div className="text-2xl font-bold">Welcome back, คุณ{emp.first_name}!</div>
          <div className="text-xl font-semibold">Let’s Grow Together!</div>
          <p className="mt-1 text-sm text-blue-100">พัฒนาศักยภาพ สร้างโอกาสในทุกก้าวของคุณ — {idx.pos[emp.position_id]?.name}</p>
          <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 text-right text-sm italic text-blue-100 md:block">“Better People<br />A Brighter Tomorrow”</div>
        </div>
      ) : (
        <PageHeader title="การเรียนรู้ของฉัน" subtitle="ติดตามการอบรม แผนพัฒนา และใบประกาศนียบัตรของคุณ" />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat icon={BookOpen} label="My Learning" value={inProgress.length + upcoming.length} sub="กำลังเรียน / ลงทะเบียน" />
        <MiniStat icon={CalendarDays} label="My Training" value={upcoming.length} sub="รุ่นอบรมที่กำลังจะถึง" />
        <MiniStat icon={Target} label="My Development Plan" value={idp ? `${idpProgress(idx, idp.id)}%` : '-'} sub={idp ? LABELS.idpStatus[idp.status] : 'ยังไม่มี IDP'} />
        <MiniStat icon={Award} label="My Certificates" value={certs.length} sub={`ชั่วโมงอบรมปีนี้ ${hours} ชม.`} />
      </div>

      <Card title="Quick Access">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {quick.map((q) => (
            <Link key={q.to} to={q.to} className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-4 text-center text-sm hover:border-brand-200 hover:bg-brand-50">
              <q.icon className="text-brand-600" size={26} />{q.label}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'active', label: 'กำลังเรียน / ลงทะเบียน', count: active.length },
            { value: 'history', label: 'ประวัติการอบรม', count: history.length },
            { value: 'certs', label: 'ใบประกาศนียบัตร', count: certs.length },
          ]} />
          {tab === 'active' && (
            <Table rows={active} empty="ยังไม่มีการลงทะเบียน — เลือกหลักสูตรจาก Course Catalog" columns={[
              { key: 'c', label: 'หลักสูตร', render: (r) => <Link to={`/courses/${r.c.id}`} className="font-medium hover:text-brand-600">{r.c.title}</Link> },
              { key: 'd', label: 'วันที่', render: (r) => <span className="whitespace-nowrap text-slate-500">{fmtRange(r.s.start_date, r.s.end_date)}</span> },
              { key: 'st', label: 'สถานะ', render: (r) => <Badge status={r.status}>{LABELS.enrollStatus[r.status]}</Badge> },
            ]} />
          )}
          {tab === 'history' && (
            <Table rows={history} columns={[
              { key: 'c', label: 'หลักสูตร', render: (r) => <span className="font-medium">{r.c.title}</span> },
              { key: 'd', label: 'วันที่', render: (r) => <span className="whitespace-nowrap text-slate-500">{fmtDate(r.s.start_date)}</span> },
              { key: 'h', label: 'ชม.', render: (r) => r.attended_hours ?? '-' },
              { key: 'sc', label: 'คะแนน', render: (r) => r.post_score ?? '-' },
              { key: 'st', label: 'ผล', render: (r) => <Badge status={r.status}>{LABELS.enrollStatus[r.status]}</Badge> },
            ]} />
          )}
          {tab === 'certs' && (
            <Table rows={certs} empty="ยังไม่มีใบประกาศนียบัตร" columns={[
              { key: 'c', label: 'หลักสูตร', render: (r) => idx.course[r.course_id]?.title },
              { key: 'n', label: 'เลขที่', render: (r) => <span className="text-slate-500">{r.cert_no}</span> },
              { key: 'i', label: 'ออกให้', render: (r) => fmtDate(r.issued_at) },
              { key: 'e', label: 'หมดอายุ', render: (r) => (r.expires_at ? <span className={new Date(r.expires_at) < TODAY ? 'text-rose-600' : ''}>{fmtDate(r.expires_at)}</span> : 'ไม่มีวันหมดอายุ') },
              { key: 'a', label: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => setCert(r)}>ดู</Button> },
            ]} />
          )}
        </Card>

        <div className="space-y-5">
          <Card title={<span className="flex items-center gap-2"><Sparkles size={17} className="text-amber-500" />หลักสูตรแนะนำสำหรับคุณ</span>}>
            {recs.length ? (
              <div className="space-y-3">
                {recs.map(({ course, reasons }) => (
                  <Link key={course.id} to={`/courses/${course.id}`} className="flex gap-3 rounded-xl p-1 hover:bg-slate-50">
                    <CourseThumb course={course} size={42} />
                    <div className="min-w-0"><div className="truncate text-sm font-medium">{course.title}</div>
                      <div className="truncate text-xs text-slate-400">{reasons.length ? `ปิด Gap: ${reasons.join(', ')}` : 'หลักสูตรภาคบังคับ'}</div></div>
                  </Link>
                ))}
              </div>
            ) : <div className="text-sm text-slate-400">ไม่มี Skill Gap ที่ต้องปิด เยี่ยมมาก!</div>}
          </Card>
          <Card title="หลักสูตรภาคบังคับ">
            <div className="space-y-2.5">
              {mandatory.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{c.title}</span>
                  {doneIds.has(c.id) ? <Badge tone="green">ผ่านแล้ว</Badge> : <Badge tone="amber">ยังไม่ผ่าน</Badge>}
                </div>
              ))}
            </div>
            {idp && <div className="mt-4 border-t border-slate-100 pt-3"><div className="mb-1 flex justify-between text-sm"><span>ความคืบหน้า IDP {CURRENT_YEAR + 543}</span><b>{idpProgress(idx, idp.id)}%</b></div><Progress value={idpProgress(idx, idp.id)} tone="green" /></div>}
          </Card>
        </div>
      </div>
      <CertificateModal cert={cert} onClose={() => setCert(null)} />
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <div className="mt-2 flex items-center gap-3"><Icon className="text-brand-600" size={26} /><span className="text-2xl font-bold text-navy-900">{value}</span></div>
      <div className="mt-1 text-xs text-slate-400">{sub}</div>
    </div>
  )
}
