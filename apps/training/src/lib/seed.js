// ชุดข้อมูลตัวอย่าง (Demo) — สร้างแบบ deterministic เพื่อให้ผลเหมือนเดิมทุกครั้ง
// ใช้ได้ทั้งโหมดสาธิต และปุ่ม "นำเข้าข้อมูลตัวอย่างไป Supabase" ในหน้าตั้งค่า

export const TODAY = new Date('2026-11-24')

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateSeed(seed = 20261124) {
  const rnd = mulberry32(seed)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
  const chance = (p) => rnd() < p
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('')
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`
  const iso = (d) => d.toISOString().slice(0, 10)
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

  // ---------------- Business units / departments ----------------
  const bus = [
    { code: 'HQ', name: 'สำนักงานใหญ่' },
    { code: 'RETAIL', name: 'ค้าปลีก (Retail)' },
    { code: 'FMCG', name: 'FMCG Sales & Distribution' },
    { code: 'FACTORY', name: 'โรงงาน (Factory)' },
  ].map((b) => ({ id: uuid(), ...b }))
  const bu = Object.fromEntries(bus.map((b) => [b.code, b]))

  const deptDefs = [
    ['HQ', 'HQ-HR', 'ทรัพยากรบุคคล', 'support'],
    ['HQ', 'HQ-FIN', 'บัญชีและการเงิน', 'support'],
    ['HQ', 'HQ-IT', 'เทคโนโลยีสารสนเทศ', 'support'],
    ['HQ', 'HQ-MKT', 'การตลาด', 'support'],
    ['RETAIL', 'RT-OPS', 'ปฏิบัติการสาขา', 'store'],
    ['RETAIL', 'RT-VM', 'Visual Merchandising', 'store'],
    ['RETAIL', 'RT-CS', 'บริการลูกค้า', 'store'],
    ['FMCG', 'FM-SALES', 'ฝ่ายขาย', 'sales'],
    ['FMCG', 'FM-TM', 'Trade Marketing', 'sales'],
    ['FMCG', 'FM-SCM', 'Supply Chain & Logistics', 'supply_chain'],
    ['FACTORY', 'FC-PROD', 'ฝ่ายผลิต', 'production'],
    ['FACTORY', 'FC-QA', 'ประกันคุณภาพ (QA)', 'quality'],
    ['FACTORY', 'FC-MT', 'ซ่อมบำรุง', 'maintenance'],
    ['FACTORY', 'FC-EHS', 'ความปลอดภัยและสิ่งแวดล้อม', 'quality'],
  ]
  const departments = deptDefs.map(([b, code, name, track]) => ({ id: uuid(), business_unit_id: bu[b].id, code, name, _track: track }))

  // ---------------- Positions (career tracks) ----------------
  const posDefs = [
    // track, code, name, level, key
    ['store', 'ST-SA', 'พนักงานขายหน้าร้าน', 1, false],
    ['store', 'ST-SUP', 'หัวหน้าแผนก (Supervisor)', 3, false],
    ['store', 'ST-ASM', 'ผู้ช่วยผู้จัดการสาขา', 4, false],
    ['store', 'ST-SM', 'ผู้จัดการสาขา', 5, true],
    ['store', 'ST-AM', 'ผู้จัดการเขต (Area Manager)', 6, true],
    ['sales', 'SL-REP', 'พนักงานขาย (Sales Representative)', 2, false],
    ['sales', 'SL-SUP', 'Sales Supervisor', 3, false],
    ['sales', 'SL-ASM', 'Area Sales Manager', 5, true],
    ['sales', 'SL-DIR', 'Sales Director', 7, true],
    ['supply_chain', 'SC-OP', 'พนักงานคลังสินค้า', 1, false],
    ['supply_chain', 'SC-PL', 'Planner / เจ้าหน้าที่วางแผน', 2, false],
    ['supply_chain', 'SC-SUP', 'หัวหน้าคลังสินค้า', 4, false],
    ['supply_chain', 'SC-MGR', 'Supply Chain Manager', 5, true],
    ['production', 'PD-OP', 'พนักงานฝ่ายผลิต', 1, false],
    ['production', 'PD-LL', 'หัวหน้าไลน์ผลิต (Line Leader)', 3, false],
    ['production', 'PD-SUP', 'Production Supervisor', 4, false],
    ['production', 'PD-MGR', 'Production Manager', 5, true],
    ['production', 'PD-PLM', 'Plant Manager', 7, true],
    ['quality', 'QA-OF', 'QA Officer', 2, false],
    ['quality', 'QA-SUP', 'QA Supervisor', 4, false],
    ['quality', 'QA-MGR', 'QA Manager', 5, true],
    ['maintenance', 'MT-TEC', 'ช่างซ่อมบำรุง', 2, false],
    ['maintenance', 'MT-SUP', 'Maintenance Supervisor', 4, false],
    ['support', 'SP-OF', 'เจ้าหน้าที่', 2, false],
    ['support', 'SP-SR', 'เจ้าหน้าที่อาวุโส', 3, false],
    ['support', 'SP-AMG', 'ผู้ช่วยผู้จัดการฝ่าย', 4, false],
    ['support', 'SP-MGR', 'ผู้จัดการฝ่าย', 5, true],
    ['support', 'SP-DIR', 'ผู้อำนวยการ', 7, true],
  ]
  const positions = posDefs.map(([track, code, name, level, key]) => ({
    id: uuid(), code, name, job_level: level, career_track: track, is_key_position: key,
  }))
  const posByCode = Object.fromEntries(positions.map((p) => [p.code, p]))
  const trackPositions = (track) => positions.filter((p) => p.career_track === track).sort((a, b) => a.job_level - b.job_level)

  // ---------------- Competencies ----------------
  const compDefs = [
    ['C-CUS', 'Customer Focus', 'core', 'มุ่งเน้นลูกค้า เข้าใจความต้องการ และส่งมอบประสบการณ์ที่ดี'],
    ['C-INT', 'Integrity', 'core', 'ซื่อสัตย์ โปร่งใส ปฏิบัติตามจรรยาบรรณ'],
    ['C-TEAM', 'Teamwork', 'core', 'ทำงานร่วมกับผู้อื่นเพื่อเป้าหมายร่วม'],
    ['C-CI', 'Continuous Improvement', 'core', 'ปรับปรุงงานอย่างต่อเนื่อง (Kaizen)'],
    ['C-SAFE', 'Safety Mindset', 'core', 'ตระหนักและปฏิบัติตามหลักความปลอดภัย'],
    ['M-LEAD', 'Leadership', 'managerial', 'นำทีม สร้างแรงบันดาลใจ และขับเคลื่อนผลลัพธ์'],
    ['M-COACH', 'Coaching & Developing Others', 'managerial', 'สอนงาน พัฒนาลูกทีม'],
    ['M-DEC', 'Decision Making', 'managerial', 'วิเคราะห์และตัดสินใจอย่างมีหลักการ'],
    ['M-PLAN', 'Planning & Organizing', 'managerial', 'วางแผนและบริหารทรัพยากร'],
    ['F-SALE', 'Sales & Negotiation', 'functional', 'ทักษะการขายและการเจรจาต่อรอง'],
    ['F-STORE', 'Store Operations', 'functional', 'มาตรฐานการบริหารร้านค้าปลีก'],
    ['F-MERCH', 'Merchandising', 'functional', 'การจัดเรียงสินค้าและบริหาร Category'],
    ['F-LEAN', 'Lean Manufacturing', 'functional', 'ระบบการผลิตแบบลีน ลดความสูญเปล่า'],
    ['F-QC', 'Quality Control', 'functional', 'ควบคุมคุณภาพตามมาตรฐาน'],
    ['F-SCM', 'Supply Chain Management', 'functional', 'บริหารห่วงโซ่อุปทานและคลังสินค้า'],
    ['T-DIGI', 'Digital Literacy', 'technical', 'ใช้เครื่องมือดิจิทัลในการทำงาน'],
    ['T-DATA', 'Data Analysis', 'technical', 'วิเคราะห์ข้อมูลเพื่อการตัดสินใจ'],
    ['T-MAINT', 'Machine Maintenance', 'technical', 'บำรุงรักษาเครื่องจักร (TPM)'],
    ['T-GMP', 'GMP / HACCP', 'technical', 'มาตรฐานความปลอดภัยอาหาร'],
  ]
  const competencies = compDefs.map(([code, name, type, description]) => ({ id: uuid(), code, name, type, description }))
  const comp = Object.fromEntries(competencies.map((c) => [c.code, c]))

  const trackComps = {
    store: ['F-STORE', 'F-MERCH', 'F-SALE'],
    sales: ['F-SALE', 'F-MERCH', 'T-DATA'],
    supply_chain: ['F-SCM', 'T-DATA', 'C-SAFE'],
    production: ['F-LEAN', 'T-GMP', 'F-QC'],
    quality: ['F-QC', 'T-GMP', 'T-DATA'],
    maintenance: ['T-MAINT', 'F-LEAN'],
    support: ['T-DIGI', 'T-DATA'],
  }
  const position_competencies = []
  for (const p of positions) {
    const base = Math.min(5, 1 + Math.ceil(p.job_level / 2))
    const codes = new Set(['C-CUS', 'C-INT', 'C-TEAM', 'C-CI', 'T-DIGI'])
    if (['production', 'maintenance', 'supply_chain', 'quality'].includes(p.career_track)) codes.add('C-SAFE')
    trackComps[p.career_track].forEach((c) => codes.add(c))
    if (p.job_level >= 3) ['M-LEAD', 'M-COACH', 'M-PLAN'].forEach((c) => codes.add(c))
    if (p.job_level >= 5) codes.add('M-DEC')
    for (const c of codes) {
      const type = comp[c].type
      const lvl = type === 'managerial' ? Math.min(5, p.job_level - 1) : type === 'core' ? Math.min(5, base) : Math.min(5, base + (p.job_level >= 3 ? 0 : 0))
      position_competencies.push({ id: uuid(), position_id: p.id, competency_id: comp[c].id, required_level: Math.max(2, lvl) })
    }
  }

  // ---------------- Employees ----------------
  const firstF = ['ณิชา', 'สุภาวดี', 'พิมพ์ชนก', 'กมลชนก', 'ศิริพร', 'อรุณี', 'ปวีณา', 'ชนิดา', 'วรรณา', 'จิราพร', 'ธนพร', 'นภัสสร', 'มณีรัตน์', 'สุนิสา', 'กัญญารัตน์', 'อัญชลี', 'รัตนา', 'ปิยะนุช', 'ดวงใจ', 'เบญจมาศ']
  const firstM = ['ธนากร', 'ศุภชัย', 'วีระพงษ์', 'อนุชา', 'ณัฐวุฒิ', 'กิตติพงษ์', 'ปรีชา', 'สมชาย', 'ชัยวัฒน์', 'ภานุวัฒน์', 'วิทยา', 'อภิสิทธิ์', 'ธีรวัฒน์', 'สุรเชษฐ์', 'จักรพันธ์', 'พงศกร', 'เอกชัย', 'นพดล', 'ศักดิ์ชัย', 'ธนวัฒน์']
  const lasts = ['พัฒนากูล', 'ศรีสุข', 'วงศ์ไทย', 'ใจดี', 'บุญมา', 'แสงทอง', 'รุ่งเรือง', 'ทองคำ', 'สมบูรณ์', 'เจริญผล', 'มั่นคง', 'ประเสริฐ', 'สุขสวัสดิ์', 'กาญจนา', 'ศรีวงศ์', 'อินทร์แก้ว', 'ชัยมงคล', 'พรหมมา', 'จันทร์เพ็ญ', 'นาคสุข', 'บุญเรือง', 'ศิริวัฒน์', 'แก้วมณี', 'สายทอง']

  const employees = []
  let seq = 100
  const mkEmp = (dept, pos, extra = {}) => {
    const female = chance(0.55)
    const hire = addDays(TODAY, -int(60, 365 * 15) * (pos.job_level >= 5 ? 1.4 : 1))
    const e = {
      id: uuid(),
      employee_code: `E${String(++seq).padStart(5, '0')}`,
      first_name: female ? pick(firstF) : pick(firstM),
      last_name: pick(lasts),
      gender: female ? 'F' : 'M',
      email: null,
      business_unit_id: dept.business_unit_id,
      department_id: dept.id,
      position_id: pos.id,
      manager_id: null,
      hire_date: iso(hire),
      status: (TODAY - hire) / 864e5 < 119 ? 'probation' : 'active',
      hrm_employee_id: seq,
      auth_user_id: null,
      synced_at: '2026-11-24T06:00:00Z',
      ...extra,
    }
    e.email = e.email || `${e.employee_code.toLowerCase()}@peoplegrow.co.th`
    employees.push(e)
    return e
  }

  // HR Director (ผู้ใช้งานหลักในโหมดสาธิต)
  const hrDept = departments.find((d) => d.code === 'HQ-HR')
  const director = mkEmp(hrDept, posByCode['SP-DIR'], { first_name: 'ณิชา', last_name: 'พัฒนากูล', gender: 'F', nickname: 'นิชา', hire_date: '2015-03-02', status: 'active', email: 'nicha.p@peoplegrow.co.th' })

  // headcount per department: [count by level...]
  const sizes = { store: 260, sales: 90, supply_chain: 70, production: 230, quality: 40, maintenance: 35, support: 22 }
  for (const d of departments) {
    const tps = d._track === 'quality' && d.code === 'FC-EHS' ? trackPositions('quality') : trackPositions(d._track)
    const total = Math.round(sizes[d._track] * (d._track === 'store' ? 0.34 : d._track === 'sales' ? 0.5 : d._track === 'support' ? 1 : 1) * (0.8 + rnd() * 0.4))
    // pyramid: top position 1, each lower level multiplies
    const levels = [...tps].reverse() // top -> bottom
    let parents = d === hrDept ? [director] : []
    levels.forEach((p, idx) => {
      let n = idx === 0 ? 1 : idx === levels.length - 1 ? Math.max(3, total - employees.filter((e) => e.department_id === d.id).length) : Math.max(1, Math.round(Math.pow(3.2, idx) * 0.9))
      if (p.job_level === 7 && d.code !== 'FC-PROD' && d.code !== 'FM-SALES' && d.code !== 'HQ-HR' && d.code !== 'HQ-FIN') n = 0
      if (d === hrDept && p.job_level === 7) n = 0
      const created = []
      for (let i = 0; i < n; i++) {
        const e = mkEmp(d, p)
        if (parents.length) e.manager_id = parents[i % parents.length].id
        created.push(e)
      }
      if (created.length) parents = created
    })
  }
  const empById = Object.fromEntries(employees.map((e) => [e.id, e]))
  const posById = Object.fromEntries(positions.map((p) => [p.id, p]))
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d]))

  // ---------------- Courses ----------------
  const courseDefs = [
    // code, title, category, format, level, hours, mandatory, bus, comps, validity, desc
    ['ORI-101', 'ปฐมนิเทศพนักงานใหม่ (New Employee Orientation)', 'Compliance', 'blended', 'basic', 6, true, [], ['C-INT', 'C-TEAM'], null, 'รู้จักองค์กร วัฒนธรรม ค่านิยม กฎระเบียบ และสวัสดิการ สำหรับพนักงานใหม่ทุกคน'],
    ['SAF-101', 'ความปลอดภัยในการทำงาน (สำหรับโรงงาน)', 'Safety', 'classroom', 'basic', 6, true, ['FACTORY', 'FMCG'], ['C-SAFE'], 12, 'หลักความปลอดภัย การชี้บ่งอันตราย การใช้ PPE และการรับมือเหตุฉุกเฉิน'],
    ['SAF-201', 'จป.หัวหน้างาน', 'Safety', 'classroom', 'intermediate', 12, false, ['FACTORY'], ['C-SAFE', 'M-LEAD'], 36, 'หลักสูตรตามกฎหมายสำหรับเจ้าหน้าที่ความปลอดภัยระดับหัวหน้างาน'],
    ['SAF-301', 'การขับรถยกอย่างปลอดภัย (Forklift Safety)', 'Safety', 'classroom', 'basic', 6, false, ['FACTORY', 'FMCG'], ['C-SAFE', 'F-SCM'], 24, 'ทฤษฎีและภาคปฏิบัติการขับรถยกตามมาตรฐาน'],
    ['CS-101', 'Customer Service Excellence', 'Functional', 'blended', 'basic', 6, false, ['RETAIL'], ['C-CUS', 'F-STORE'], null, 'สร้างประสบการณ์ลูกค้าที่ประทับใจ การรับมือข้อร้องเรียน และ Service Mind'],
    ['RT-201', 'Store Operation Standard', 'Functional', 'blended', 'intermediate', 9, false, ['RETAIL'], ['F-STORE', 'M-PLAN'], null, 'มาตรฐานการบริหารสาขา สต๊อก กะงาน และ KPI ร้านค้า'],
    ['RT-202', 'Visual Merchandising & Planogram', 'Functional', 'classroom', 'intermediate', 6, false, ['RETAIL', 'FMCG'], ['F-MERCH'], null, 'หลักการจัดเรียงสินค้า Planogram และการสร้างยอดขายหน้าร้าน'],
    ['SL-201', 'Professional Selling & Negotiation', 'Functional', 'classroom', 'intermediate', 12, false, ['FMCG', 'RETAIL'], ['F-SALE'], null, 'เทคนิคการขายแบบที่ปรึกษา และการเจรจาต่อรองแบบ Win-Win'],
    ['SL-301', 'Key Account Management', 'Functional', 'classroom', 'advanced', 12, false, ['FMCG'], ['F-SALE', 'T-DATA'], null, 'บริหารลูกค้ารายใหญ่ Modern Trade และ Joint Business Plan'],
    ['FM-101', 'FMCG Business Insight', 'Functional', 'e-learning', 'basic', 3, false, ['FMCG', 'RETAIL'], ['F-SALE', 'F-MERCH'], null, 'ภาพรวมธุรกิจ FMCG ช่องทางจัดจำหน่าย และพฤติกรรมผู้บริโภค'],
    ['SC-201', 'Supply Chain & Inventory Fundamentals', 'Functional', 'e-learning', 'basic', 4, false, ['FMCG', 'FACTORY'], ['F-SCM'], null, 'พื้นฐานห่วงโซ่อุปทาน การวางแผนสต๊อก และ KPI คลังสินค้า'],
    ['PD-101', '5ส. และ Visual Control', 'Functional', 'ojt', 'basic', 4, false, ['FACTORY'], ['C-CI', 'F-LEAN'], null, 'หลัก 5ส. และการควบคุมด้วยสายตาในพื้นที่ผลิต'],
    ['PD-201', 'Lean Manufacturing & Kaizen', 'Functional', 'classroom', 'intermediate', 12, false, ['FACTORY'], ['F-LEAN', 'C-CI'], null, 'ลดความสูญเปล่า 8 ประการ Value Stream Mapping และ Kaizen Event'],
    ['QA-101', 'GMP & HACCP', 'Compliance', 'classroom', 'basic', 6, true, ['FACTORY'], ['T-GMP', 'F-QC'], 12, 'มาตรฐานหลักเกณฑ์วิธีการที่ดีในการผลิตอาหาร และการวิเคราะห์อันตราย'],
    ['QA-201', 'QC 7 Tools & Problem Solving', 'Functional', 'classroom', 'intermediate', 6, false, ['FACTORY'], ['F-QC', 'T-DATA'], null, 'เครื่องมือคุณภาพ 7 อย่าง และการแก้ปัญหาแบบ PDCA'],
    ['MT-201', 'Preventive Maintenance & TPM', 'Functional', 'blended', 'intermediate', 9, false, ['FACTORY'], ['T-MAINT', 'F-LEAN'], null, 'การบำรุงรักษาเชิงป้องกันและ Total Productive Maintenance'],
    ['LD-201', 'Leadership for New Manager', 'Leadership', 'classroom', 'intermediate', 12, false, [], ['M-LEAD', 'M-COACH', 'M-PLAN'], null, 'เปลี่ยนบทบาทจากผู้ปฏิบัติสู่ผู้นำ การบริหารทีม การมอบหมายงาน'],
    ['LD-202', 'Coaching Skills for Leaders', 'Leadership', 'classroom', 'intermediate', 6, false, [], ['M-COACH'], null, 'การโค้ชด้วยโมเดล GROW และการให้ Feedback อย่างสร้างสรรค์'],
    ['LD-301', 'Leadership for Future Leaders', 'Leadership', 'blended', 'advanced', 24, false, [], ['M-LEAD', 'M-DEC', 'M-PLAN'], null, 'หลักสูตรพัฒนากลุ่ม Talent สู่ผู้บริหารระดับกลาง–สูง'],
    ['LD-302', 'Strategic Thinking & Decision Making', 'Leadership', 'classroom', 'advanced', 12, false, [], ['M-DEC'], null, 'คิดเชิงกลยุทธ์ วิเคราะห์ทางเลือก และตัดสินใจภายใต้ความไม่แน่นอน'],
    ['SS-101', 'Effective Communication', 'Soft Skill', 'classroom', 'basic', 6, false, [], ['C-TEAM', 'C-CUS'], null, 'สื่อสารอย่างมีประสิทธิภาพ ฟังอย่างตั้งใจ และนำเสนออย่างมั่นใจ'],
    ['SS-102', 'Problem Solving & Critical Thinking', 'Soft Skill', 'e-learning', 'basic', 3, false, [], ['C-CI', 'M-DEC'], null, 'กระบวนการคิดแก้ปัญหาอย่างเป็นระบบ'],
    ['DG-101', 'Digital Skills for All', 'Digital', 'e-learning', 'basic', 3, false, [], ['T-DIGI'], null, 'ทักษะดิจิทัลพื้นฐาน เครื่องมือออนไลน์ และความปลอดภัยไซเบอร์'],
    ['DG-201', 'Data Analytics with Excel & Power BI', 'Digital', 'blended', 'intermediate', 12, false, [], ['T-DATA', 'T-DIGI'], null, 'วิเคราะห์ข้อมูลและสร้าง Dashboard เพื่อการตัดสินใจ'],
    ['CP-101', 'PDPA & Code of Conduct', 'Compliance', 'e-learning', 'basic', 2, true, [], ['C-INT'], 24, 'กฎหมายคุ้มครองข้อมูลส่วนบุคคล และจรรยาบรรณทางธุรกิจ'],
  ]
  const courses = courseDefs.map(([code, title, category, format, level, hours, mand, tbu, comps, validity, description]) => ({
    id: uuid(), code, title, category, format, level, hours, is_mandatory: mand, target_bu: tbu,
    validity_months: validity, description, pass_score: 70, status: 'published',
    objectives: ['เข้าใจหลักการและแนวคิดสำคัญ', 'ประยุกต์ใช้กับงานจริงได้', 'วัดผลได้ด้วยแบบทดสอบหลังเรียน'],
    _comps: comps,
  }))
  const course_competencies = courses.flatMap((c) => c._comps.map((cc) => ({ course_id: c.id, competency_id: comp[cc].id })))
  const modTypes = { classroom: ['workshop', 'workshop', 'assignment', 'quiz'], 'e-learning': ['video', 'video', 'pdf', 'quiz'], blended: ['video', 'workshop', 'assignment', 'quiz'], ojt: ['pdf', 'workshop', 'assignment'] }
  const modTitles = ['บทนำและภาพรวม', 'หลักการสำคัญ', 'กรณีศึกษา (Case Study)', 'ฝึกปฏิบัติ', 'แบบทดสอบหลังเรียน']
  const course_modules = courses.flatMap((c) => modTypes[c.format].map((t, i) => ({
    id: uuid(), course_id: c.id, seq: i + 1,
    title: `บทที่ ${i + 1}: ${t === 'quiz' ? 'แบบทดสอบหลังเรียน' : modTitles[i]}`,
    type: t, minutes: t === 'quiz' ? 15 : int(20, 90), content_url: null,
  })))

  // ---------------- Trainers ----------------
  const trainerDefs = [
    ['อ.สมพงษ์ ลีลาวัฒน์', 'external', 'Leadership & Strategy'], ['อ.ปิยะดา ชาญวิทย์', 'external', 'Coaching / Communication'],
    ['อ.วรวุฒิ เกียรติศักดิ์', 'external', 'Lean / TPM'], ['อ.กนกพร ศรีอุดม', 'external', 'Customer Service'],
    ['บริษัท Safety First Training', 'external', 'Safety / จป.'], ['ดร.ธีรศักดิ์ มงคลชัย', 'external', 'Data Analytics'],
    ['คุณอนุชา บุญมา (Internal)', 'internal', 'Store Operations'], ['คุณศิริพร แสงทอง (Internal)', 'internal', 'QA / GMP'],
    ['คุณจักรพันธ์ ทองคำ (Internal)', 'internal', 'Sales'], ['ทีม HRD (Internal)', 'internal', 'Orientation / Compliance'],
  ]
  const trainers = trainerDefs.map(([name, type, expertise]) => ({ id: uuid(), name, type, expertise, employee_id: null, rating: +(4 + rnd() * 0.9).toFixed(2) }))
  const trainerFor = (c) => {
    const m = { Leadership: [0, 1], Safety: [4], Digital: [5], Compliance: [9, 7], 'Soft Skill': [1, 3] }
    if (c.code.startsWith('PD') || c.code.startsWith('MT')) return trainers[2]
    if (c.code.startsWith('QA')) return trainers[7]
    if (c.code.startsWith('CS')) return trainers[3]
    if (c.code.startsWith('RT')) return trainers[6]
    if (c.code.startsWith('SL') || c.code.startsWith('FM')) return trainers[8]
    return trainers[pick(m[c.category] || [9])]
  }
  const venues = ['ห้องอบรม A ชั้น 5 สำนักงานใหญ่', 'ห้องอบรม B ชั้น 5 สำนักงานใหญ่', 'ห้องประชุมโรงงานบางนา', 'ศูนย์ฝึกอบรมโรงงานนวนคร', 'Online (MS Teams)', 'ศูนย์กระจายสินค้าวังน้อย']

  // ---------------- Sessions / enrollments / certificates ----------------
  const training_sessions = []
  const enrollments = []
  const certificates = []
  const eligible = (c) => employees.filter((e) => {
    const p = posById[e.position_id]
    const b = bus.find((x) => x.id === e.business_unit_id).code
    if (c.target_bu.length && !c.target_bu.includes(b) && b !== 'HQ') return false
    if (c.category === 'Leadership') return p.job_level >= (c.level === 'advanced' ? 4 : 3)
    if (c.code === 'SAF-201') return p.job_level >= 3
    if (c.code === 'ORI-101') return (TODAY - new Date(e.hire_date)) / 864e5 < 400
    return true
  })
  let certSeq = 0
  const taken = new Set()
  for (const c of courses) {
    const pool = eligible(c)
    const nSessions = c.format === 'e-learning' ? int(1, 2) : c.is_mandatory ? int(4, 6) : int(2, 4)
    const starts = Array.from({ length: nSessions }, (_, i) => new Date(2026, 0, 5 + Math.floor((i / nSessions) * 365) + int(0, Math.floor(330 / nSessions))))
    if (!starts.some((d) => d > TODAY)) starts.push(new Date(2026, 11, int(1, 60)))
    for (let b = 1; b <= starts.length; b++) {
      const start = starts[b - 1]
      const days = c.format === 'e-learning' ? 30 : Math.max(1, Math.ceil(c.hours / 6))
      const end = addDays(start, days - 1)
      const capacity = c.format === 'e-learning' ? 200 : c.category === 'Leadership' ? 25 : int(25, 40)
      const status = end < TODAY ? 'completed' : start <= TODAY ? 'ongoing' : addDays(TODAY, 75) > start ? 'open' : 'planned'
      const s = {
        id: uuid(), course_id: c.id, batch_no: b, start_date: iso(start), end_date: iso(end),
        start_time: '09:00', end_time: c.format === 'e-learning' ? '23:59' : '16:00',
        venue: c.format === 'e-learning' ? 'e-Learning (LMS)' : pick(venues), trainer_id: trainerFor(c).id,
        capacity, cost: c.format === 'e-learning' ? 15000 : Math.round(c.hours * int(2500, 6000) / 1000) * 1000, status,
      }
      training_sessions.push(s)
      if (status === 'planned') continue
      const fill = status === 'completed' ? 0.75 + rnd() * 0.25 : status === 'ongoing' ? 0.85 : 0.35 + rnd() * 0.5
      const n = Math.min(pool.length, Math.round(capacity * fill))
      const chosen = new Set()
      while (chosen.size < n) chosen.add(pick(pool))
      for (const e of chosen) {
        if (taken.has(e.id + c.id)) continue
        taken.add(e.id + c.id)
        const en = { id: uuid(), session_id: s.id, employee_id: e.id, source: c.is_mandatory ? 'mandatory' : pick(['self', 'manager', 'idp', 'hr']), created_at: iso(addDays(start, -int(7, 30))) + 'T09:00:00Z' }
        if (status === 'completed') {
          const r = rnd()
          if (r < 0.04) en.status = 'no_show'
          else {
            en.pre_score = int(35, 70)
            en.post_score = Math.min(100, en.pre_score + int(10, 40))
            en.status = en.post_score >= c.pass_score ? 'completed' : 'failed'
            en.attended_hours = c.hours
            en.satisfaction = +(3.6 + rnd() * 1.4).toFixed(1)
            if ((TODAY - end) / 864e5 > 45 ? chance(0.95) : chance(0.55)) en.behavior_score = +(3 + rnd() * 2).toFixed(1)
          }
          en.approved_at = en.created_at
        } else if (status === 'ongoing') {
          en.status = 'approved'; en.approved_at = en.created_at
        } else {
          en.status = chance(0.06) ? 'requested' : 'approved'
          if (en.status === 'approved') en.approved_at = en.created_at
        }
        en.approved_by = en.status !== 'requested' ? empById[e.manager_id]?.id || null : null
        enrollments.push(en)
        if (en.status === 'completed') {
          certificates.push({
            id: uuid(), cert_no: `PG-${s.start_date.slice(0, 4)}-${String(++certSeq).padStart(5, '0')}`, enrollment_id: en.id,
            employee_id: e.id, course_id: c.id, score: en.post_score, issued_at: s.end_date,
            expires_at: c.validity_months ? iso(addDays(new Date(s.end_date), c.validity_months * 30)) : null,
          })
        }
      }
    }
  }

  // ---------------- Competency assessments (2026) ----------------
  const competency_assessments = []
  const reqByPos = {}
  position_competencies.forEach((pc) => { (reqByPos[pc.position_id] ||= []).push(pc) })
  for (const e of employees) {
    if (e !== director && !chance(0.72)) continue
    for (const pc of reqByPos[e.position_id] || []) {
      const final = Math.max(1, Math.min(5, pc.required_level + pick([-2, -1, -1, 0, 0, 0, 1])))
      competency_assessments.push({
        id: uuid(), employee_id: e.id, competency_id: pc.competency_id, period: '2026',
        self_level: Math.min(5, final + pick([0, 0, 1])), manager_level: final, final_level: final,
        assessed_at: '2026-' + String(int(3, 10)).padStart(2, '0') + '-15T10:00:00Z',
      })
    }
  }

  // ---------------- Performance results ----------------
  const performance_results = []
  for (const e of employees) {
    for (const y of [2025, 2026]) {
      if (y === 2025 && new Date(e.hire_date) > new Date('2025-06-30')) continue
      const score = +(2.2 + rnd() * 2.7).toFixed(2)
      performance_results.push({ id: uuid(), employee_id: e.id, year: y, score, grade: score >= 4.5 ? 'A' : score >= 3.5 ? 'B' : score >= 2.5 ? 'C' : 'D', source_ref: 'performance_review' })
    }
  }
  const perfOf = (id, y = 2026) => performance_results.find((p) => p.employee_id === id && p.year === y)

  // ---------------- Talent reviews (9-box) ----------------
  const talent_reviews = []
  for (const e of employees) {
    const p = posById[e.position_id]
    if (p.job_level < 2 && !chance(0.08)) continue
    const pr = perfOf(e.id)
    const perf = pr ? (pr.score >= 4.3 ? 3 : pr.score >= 3.0 ? 2 : 1) : 2
    const pot = chance(0.18) ? int(1, 3) : Math.max(1, Math.min(3, perf + pick([-1, 0, 0, 0, 1])))
    talent_reviews.push({ id: uuid(), employee_id: e.id, year: 2026, performance: perf, potential: pot, is_talent: perf + pot >= 5, flight_risk: pick(['low', 'low', 'low', 'medium', 'high']), note: null })
  }

  // ---------------- Career paths ----------------
  const career_paths = []
  for (const track of Object.keys(trackComps)) {
    const tps = trackPositions(track)
    for (let i = 0; i < tps.length - 1; i++) {
      const to = tps[i + 1]
      const toBu = { store: 'RETAIL', sales: 'FMCG', supply_chain: 'FMCG', production: 'FACTORY', quality: 'FACTORY', maintenance: 'FACTORY', support: null }[track]
      const toComps = new Set(position_competencies.filter((pc) => pc.position_id === to.id).map((pc) => pc.competency_id))
      const reqCourses = courses
        .filter((c) => !c.is_mandatory && (!c.target_bu.length || (toBu && c.target_bu.includes(toBu))) && (to.job_level >= 3 || c.category !== 'Leadership'))
        .map((c) => ({ c, score: c._comps.filter((cc) => toComps.has(comp[cc].id)).length * 2 + (to.job_level >= 3 && c.category === 'Leadership' ? 2 : 0) + (c.target_bu.length ? 1 : 0) - (c.level === 'advanced' && to.job_level < 5 ? 3 : 0) }))
        .filter((x) => x.score > 1).sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.c)
      career_paths.push({ id: uuid(), from_position_id: tps[i].id, to_position_id: to.id, min_years: to.job_level >= 5 ? 3 : 2, min_performance: 'B', required_course_ids: reqCourses.map((c) => c.id), note: null })
    }
  }

  // ---------------- IDPs ----------------
  const idps = []
  const idp_items = []
  const methods = [['training', 0.1], ['ojt', 0.7], ['coaching', 0.2]]
  for (const e of employees) {
    const p = posById[e.position_id]
    if (!(p.job_level >= 2 ? chance(0.75) : chance(0.35))) continue
    const next = career_paths.find((cp) => cp.from_position_id === p.id)
    const status = pick(['approved', 'in_progress', 'in_progress', 'in_progress', 'in_progress', 'in_progress', 'completed', 'completed', 'submitted', 'draft', 'approved', 'in_progress', 'in_progress', 'in_progress', 'in_progress', 'completed'])
    const idp = { id: uuid(), employee_id: e.id, year: 2026, goal: next ? `เตรียมความพร้อมสู่ตำแหน่ง ${posById[next.to_position_id].name}` : 'พัฒนาความเชี่ยวชาญในตำแหน่งปัจจุบัน', target_position_id: next?.to_position_id || null, status, approved_by: e.manager_id, created_at: '2026-02-01T09:00:00Z' }
    idps.push(idp)
    const reqs = (reqByPos[next?.to_position_id || p.id] || []).slice().sort(() => rnd() - 0.5).slice(0, int(2, 4))
    reqs.forEach((pc, i) => {
      const m = i === 0 ? 'training' : pick(['training', 'ojt', 'coaching', 'project', 'self_learning'])
      const course = m === 'training' ? courses.find((c) => course_competencies.some((cc) => cc.course_id === c.id && cc.competency_id === pc.competency_id)) : null
      const cname = competencies.find((c) => c.id === pc.competency_id).name
      const target = iso(new Date(2026, ['draft', 'submitted'].includes(status) ? int(12, 15) : int(4, 14), int(1, 28)))
      const past = new Date(target) < TODAY
      const progress = status === 'completed' ? 100 : status === 'draft' || status === 'submitted' ? 0
        : past ? pick([100, 100, 100, 100, 100, 100, 80, 60]) : pick([0, 20, 40, 60, 80])
      idp_items.push({
        id: uuid(), idp_id: idp.id, competency_id: pc.competency_id, method: m, course_id: course?.id || null,
        title: course ? course.title : m === 'ojt' ? `On-the-job: มอบหมายงานพัฒนา ${cname}` : m === 'coaching' ? `Coaching กับหัวหน้างาน: ${cname}` : m === 'project' ? `โครงการพิเศษด้าน ${cname}` : `เรียนรู้ด้วยตนเอง: ${cname}`,
        target_date: target, progress,
        status: progress === 100 ? 'completed' : new Date(target) < TODAY ? 'overdue' : progress > 0 ? 'in_progress' : 'not_started',
      })
    })
  }
  void methods

  // ---------------- Succession ----------------
  const succession_plans = []
  const succession_candidates = []
  const keyHolders = employees.filter((e) => posById[e.position_id].is_key_position)
  for (const inc of keyHolders.slice().sort(() => rnd() - 0.5).slice(0, 14)) {
    const pos = posById[inc.position_id]
    const plan = { id: uuid(), position_id: pos.id, department_id: inc.department_id, incumbent_id: inc.id, vacancy_risk: pick(['low', 'medium', 'medium', 'high']) }
    succession_plans.push(plan)
    const lower = employees.filter((e) => e.department_id === inc.department_id && posById[e.position_id].job_level < pos.job_level && posById[e.position_id].job_level >= pos.job_level - 2)
    lower.sort(() => rnd() - 0.5).slice(0, int(1, 3)).forEach((c) => {
      const readiness = pick(['ready_now', '1_2_years', '1_2_years', '3_plus_years'])
      succession_candidates.push({ id: uuid(), plan_id: plan.id, employee_id: c.id, readiness, readiness_pct: readiness === 'ready_now' ? int(85, 98) : readiness === '1_2_years' ? int(60, 84) : int(30, 59) })
    })
  }

  // ---------------- Budget / announcements / integrations ----------------
  const training_budgets = [
    ['HQ', 650000], ['RETAIL', 950000], ['FMCG', 750000], ['FACTORY', 1150000],
  ].map(([b, v]) => ({ id: uuid(), business_unit_id: bu[b].id, year: 2026, budget: v }))

  const announcements = [
    ['เปิดลงทะเบียนหลักสูตร Leadership Program 2027', 'เปิดรับสมัครผู้บริหารระดับกลางเข้าร่วมโครงการพัฒนาผู้นำ รุ่นที่ 5 รับจำนวนจำกัด 25 ท่าน', 'program', '2026-11-20'],
    ['โครงการ Talent Program รุ่นที่ 3', 'ประกาศรายชื่อพนักงานกลุ่ม Talent ประจำปี 2026 และกำหนดการ Development Center', 'talent', '2026-11-10'],
    ['เสวนา “เส้นทางอาชีพในองค์กร”', 'พบกับผู้บริหารที่เติบโตจากพนักงานหน้าร้านสู่ผู้จัดการเขต แชร์ประสบการณ์และแนวทางพัฒนาตนเอง', 'event', '2026-11-05'],
    ['ต่ออายุใบรับรองความปลอดภัย (Safety) ภายในธันวาคม', 'พนักงานโรงงานที่ใบรับรองใกล้หมดอายุ กรุณาลงทะเบียนอบรมทบทวนก่อน 31 ธ.ค. 2026', 'compliance', '2026-10-28'],
    ['แผนการอบรมประจำปี 2027 พร้อมแล้ว', 'ดูปฏิทินการอบรมทั้งปีและวางแผน IDP ร่วมกับหัวหน้างานได้ที่เมนูแผนพัฒนาบุคลากร', 'news', '2026-10-15'],
  ].map(([title, body, category, d]) => ({ id: uuid(), title, body, category, published_at: d }))

  const integrations = [
    ['HR_CORE', 'HR Core', 'inbound', 'ข้อมูลพนักงาน โครงสร้างองค์กร ตำแหน่ง หัวหน้างาน', 'connected', employees.length],
    ['RECRUITMENT', 'Recruitment (ATS)', 'inbound', 'ผู้สมัคร / พนักงานใหม่ → สร้างแผน Onboarding และหลักสูตรปฐมนิเทศอัตโนมัติ', 'connected', 46],
    ['TIME', 'Time & Attendance', 'both', 'ชั่วโมงเข้าอบรม ↔ บันทึกเวลาทำงาน (ไม่นับขาดงาน)', 'connected', 1820],
    ['PERFORMANCE', 'Performance Management', 'both', 'ผลประเมิน KPI → Talent Review / IDP, ส่งผลการพัฒนากลับ', 'connected', performance_results.length],
    ['COMP_BEN', 'Compensation & Benefits', 'outbound', 'ใบรับรอง/การเลื่อนตำแหน่ง → ปรับค่าจ้าง ค่าวิชาชีพ', 'warning', 320],
    ['SUCCESSION', 'Succession & Talent', 'both', 'กลุ่ม Talent / แผนสืบทอดตำแหน่ง (ภายใน HRD)', 'connected', succession_candidates.length],
  ].map(([system_code, name, direction, description, status, records], i) => ({
    id: uuid(), system_code, name, direction, description, status, records,
    last_sync_at: new Date(Date.UTC(2026, 10, 24, 6 - i, 0)).toISOString(),
  }))
  const sync_logs = []
  for (let d = 0; d < 7; d++) {
    for (const it of integrations) {
      const st = it.status === 'warning' && d === 0 ? 'partial' : chance(0.04) ? 'failed' : 'success'
      const t = new Date(Date.UTC(2026, 10, 24 - d, 6, int(0, 50)))
      sync_logs.push({ id: uuid(), system_code: it.system_code, started_at: t.toISOString(), finished_at: new Date(t.getTime() + int(4, 90) * 1000).toISOString(), status: st, inserted: int(0, 12), updated: int(0, 140), message: st === 'success' ? 'Sync สำเร็จ' : st === 'partial' ? 'บางรายการไม่ตรงรหัสตำแหน่ง (3 รายการ)' : 'Timeout เชื่อมต่อปลายทาง' })
    }
  }

  // ลบ field ภายใน
  departments.forEach((d) => delete d._track)
  courses.forEach((c) => delete c._comps)

  return {
    business_units: bus, departments, positions, employees, competencies, position_competencies,
    competency_assessments, courses, course_competencies, course_modules, trainers, training_sessions,
    enrollments, certificates, idps, idp_items, career_paths, talent_reviews, succession_plans,
    succession_candidates, performance_results, training_budgets, announcements, integrations, sync_logs,
    user_roles: [],
    _meta: { directorId: director.id, deptById: Object.keys(deptById).length },
  }
}
