import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Card, Input, PageHeader, Select, Table } from '../components/ui'
import { employeeHours, idpProgress } from '../lib/analytics'
import { downloadCSV, fmtDate, fullName } from '../lib/format'
import { useStore } from '../lib/store'

export default function Employees() {
  const { data, idx, visibleEmpIds } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [bu, setBu] = useState('')
  const [dept, setDept] = useState('')
  const [flag, setFlag] = useState('')
  const rows = useMemo(() => data.employees.filter((e) => visibleEmpIds.has(e.id)).map((e) => ({
    ...e, hours: employeeHours(idx, e.id), idp: idx.idpByEmp[e.id], talent: idx.talentByEmp[e.id]?.is_talent,
  })), [data, idx, visibleEmpIds])
  const list = rows.filter((e) => (!q || `${fullName(e)} ${e.employee_code} ${e.nickname || ''}`.includes(q)) && (!bu || e.business_unit_id === bu) && (!dept || e.department_id === dept)
    && (!flag || (flag === 'talent' && e.talent) || (flag === 'noidp' && !e.idp) || (flag === 'notrain' && !e.hours) || (flag === 'probation' && e.status === 'probation')))

  const exportCsv = () => downloadCSV('employees_hrd.csv', list.map((e) => ({
    รหัส: e.employee_code, ชื่อ: fullName(e), สายธุรกิจ: idx.bu[e.business_unit_id]?.name, หน่วยงาน: idx.dept[e.department_id]?.name, ตำแหน่ง: idx.pos[e.position_id]?.name,
    วันเริ่มงาน: e.hire_date, ชั่วโมงอบรมปีนี้: e.hours, IDP: e.idp ? `${idpProgress(idx, e.idp.id)}%` : '-', Talent: e.talent ? 'Y' : '',
  })))

  return (
    <div>
      <PageHeader title="พนักงาน" subtitle={`ข้อมูลจาก HR Core (sync อัตโนมัติ) · ${list.length.toLocaleString()} คน`} crumbs={[{ label: 'HRD', to: '/' }, { label: 'พนักงาน' }]}
        actions={<Button variant="secondary" onClick={exportCsv}><Download size={16} />Export CSV</Button>} />
      <Card>
        <div className="mb-3 grid gap-3 md:grid-cols-4">
          <Input placeholder="ค้นหาชื่อ / รหัส / ชื่อเล่น" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={bu} onChange={(e) => { setBu(e.target.value); setDept('') }}><option value="">ทุกสายธุรกิจ</option>{data.business_units.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select value={dept} onChange={(e) => setDept(e.target.value)}><option value="">ทุกหน่วยงาน</option>{data.departments.filter((d) => !bu || d.business_unit_id === bu).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          <Select value={flag} onChange={(e) => setFlag(e.target.value)}><option value="">ทั้งหมด</option><option value="talent">กลุ่ม Talent</option><option value="noidp">ยังไม่มี IDP</option><option value="notrain">ยังไม่ได้อบรมปีนี้</option><option value="probation">ทดลองงาน</option></Select>
        </div>
        <Table rows={list} max={100} onRowClick={(e) => nav(`/employees/${e.id}`)} columns={[
          { key: 'n', label: 'พนักงาน', render: (e) => <div className="flex items-center gap-2"><Avatar emp={e} size={32} /><div><div className="font-medium">{fullName(e)}</div><div className="text-xs text-slate-400">{e.employee_code}</div></div></div> },
          { key: 'p', label: 'ตำแหน่ง', render: (e) => <div><div>{idx.pos[e.position_id]?.name}</div><div className="text-xs text-slate-400">{idx.dept[e.department_id]?.name}</div></div> },
          { key: 'b', label: 'สายธุรกิจ', className: 'hidden lg:table-cell', render: (e) => <span className="text-slate-500">{idx.bu[e.business_unit_id]?.name}</span> },
          { key: 'h', label: 'วันเริ่มงาน', className: 'hidden md:table-cell', render: (e) => fmtDate(e.hire_date) },
          { key: 'hr', label: 'ชม.อบรมปีนี้', render: (e) => e.hours },
          { key: 'i', label: 'IDP', render: (e) => (e.idp ? `${idpProgress(idx, e.idp.id)}%` : <span className="text-slate-300">-</span>) },
          { key: 't', label: '', render: (e) => <div className="flex gap-1">{e.talent && <Badge tone="violet">Talent</Badge>}{e.status === 'probation' && <Badge tone="amber">ทดลองงาน</Badge>}</div> },
        ]} />
      </Card>
    </div>
  )
}
