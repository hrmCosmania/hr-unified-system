import { Award, Printer, Sprout } from 'lucide-react'
import { fmtDate, fullName } from '../lib/format'
import { useStore } from '../lib/store'
import { Button, Modal } from './ui'

export default function CertificateModal({ cert, onClose }) {
  const { idx } = useStore()
  if (!cert) return null
  const emp = idx.emp[cert.employee_id]
  const course = idx.course[cert.course_id]
  return (
    <Modal open={!!cert} onClose={onClose} title="ใบประกาศนียบัตร" wide
      footer={<><Button variant="secondary" onClick={onClose}>ปิด</Button><Button onClick={() => window.print()}><Printer size={16} />พิมพ์ / บันทึก PDF</Button></>}>
      <div className="print-area mx-auto aspect-[1.414] max-w-3xl rounded-xl border-[10px] border-double border-amber-300 bg-gradient-to-br from-amber-50 to-white p-10 text-center">
        <div className="flex items-center justify-center gap-2 text-navy-800"><Sprout className="text-emerald-500" /><b>PeopleGrow Academy</b></div>
        <div className="mt-6 font-serif text-3xl tracking-wide text-navy-900">Certificate of Completion</div>
        <div className="mt-1 text-sm text-slate-500">ใบประกาศนียบัตรนี้ให้ไว้เพื่อแสดงว่า</div>
        <div className="mt-5 text-3xl font-bold text-brand-700">{fullName(emp)}</div>
        <div className="mt-1 text-sm text-slate-500">รหัสพนักงาน {emp?.employee_code}</div>
        <div className="mt-5 text-sm text-slate-600">ได้ผ่านการอบรมและการประเมินผลหลักสูตร</div>
        <div className="mt-1 text-xl font-semibold text-navy-900">{course?.title}</div>
        <div className="mt-1 text-sm text-slate-500">จำนวน {course?.hours} ชั่วโมง · คะแนน {cert.score ?? '-'} / 100</div>
        <div className="mt-8 flex items-end justify-between text-xs text-slate-500">
          <div className="text-left">เลขที่ {cert.cert_no}<br />ออกให้ ณ วันที่ {fmtDate(cert.issued_at)}{cert.expires_at && <><br />หมดอายุ {fmtDate(cert.expires_at)}</>}</div>
          <Award size={56} className="text-amber-500" />
          <div className="text-right"><div className="mb-1 font-serif text-lg italic text-navy-800">Nicha P.</div>_____________________<br />ผู้อำนวยการฝ่ายทรัพยากรบุคคล</div>
        </div>
      </div>
    </Modal>
  )
}
