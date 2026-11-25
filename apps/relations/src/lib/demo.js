// ข้อมูลตัวอย่างสำหรับโหมด Demo — โครงสร้างเหมือนตาราง er_* ใน Supabase ทุกประการ
let seed = 20261125
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
let uid = 0
const id = (p) => `${p}-${(++uid).toString(36).padStart(5, '0')}`
const today = new Date('2026-11-25T09:00:00+07:00')
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const iso = (d) => d.toISOString()
const ymd = (d) => d.toISOString().slice(0, 10)

const FIRST = ['สริยา', 'อนันยา', 'ปกรณ์', 'ณัฐวุฒิ', 'กมลชนก', 'ธนพล', 'พิมพ์ชนก', 'วรเชษฐ์', 'ศิริพร', 'ชยพล', 'ภัทรา', 'อรรถพล', 'จิราพร', 'กิตติพัฒน์', 'นภัสสร', 'ธีรวัฒน์', 'สุภาวดี', 'ปิยะพงษ์', 'ณิชา', 'วีรยุทธ', 'เบญจมาศ', 'ศุภชัย', 'ปวีณา', 'อภิชาติ', 'ชนิดา', 'รัฐพล', 'มณีรัตน์', 'สิทธิชัย', 'พรทิพย์', 'เอกชัย', 'ลลิตา', 'ภูมิพัฒน์', 'ธิดารัตน์', 'วิทยา', 'กัญญาณัฐ', 'ปรเมศวร์']
const LAST = ['ศรีสุข', 'วงศ์ใหญ่', 'ทองดี', 'แก้วมณี', 'ใจงาม', 'สุขสวัสดิ์', 'รุ่งเรือง', 'บุญมา', 'พงษ์ไพบูลย์', 'จันทร์เพ็ญ', 'ศักดิ์สิทธิ์', 'เจริญผล', 'มั่นคง', 'อินทร์แก้ว', 'ชัยมงคล', 'สายทอง']
const NICK = ['ฝน', 'แพร', 'บอส', 'ต้น', 'มายด์', 'เบส', 'ปอ', 'นุ่น', 'กิ๊ฟ', 'โอ๊ต', 'แบม', 'เจ', 'มุก', 'ภูมิ', 'ฟ้า', 'อาร์ม', 'ใบเตย', 'ปลา']
const DEPTS = [
  ['HR', 'ทรัพยากรบุคคล'], ['SALES', 'ฝ่ายขาย'], ['MKT', 'การตลาด'], ['OPS', 'ปฏิบัติการ'],
  ['IT', 'เทคโนโลยีสารสนเทศ'], ['FIN', 'บัญชีและการเงิน'], ['PROD', 'ผลิต'], ['CS', 'บริการลูกค้า']
]
const POS = { 1: 'เจ้าหน้าที่', 2: 'เจ้าหน้าที่อาวุโส', 3: 'หัวหน้างาน', 4: 'ผู้จัดการ', 5: 'ผู้จัดการอาวุโส', 6: 'ผู้อำนวยการ' }

export function buildDemo() {
  seed = 20261125; uid = 0
  const t = {}
  t.er_departments = DEPTS.map(([code, name]) => ({ id: id('dep'), code: 'HQ-' + code, name, company: 'HQ' }))

  // พนักงาน
  const emps = []
  const me = {
    id: 'emp-me', employee_code: 'E0001', first_name: 'สริยา', last_name: 'กิตติวงศ์', nickname: 'ฝน', email: 'sariya@company.co.th',
    company: 'HQ', department_id: t.er_departments[0].id, position_name: 'HR Director', job_level: 6, manager_id: null,
    hire_date: '2015-03-02', end_date: null, status: 'active', auth_user_id: 'demo'
  }
  emps.push(me)
  const heads = {}
  t.er_departments.forEach((d, i) => {
    if (i === 0) { heads[d.id] = me; return }
    const h = mkEmp(d, 5, me.id); heads[d.id] = h; emps.push(h)
  })
  function mkEmp(d, lvl, mgr, extra = {}) {
    const hireDaysAgo = extra.hireDaysAgo ?? int(20, 4200)
    const e = {
      id: id('emp'), employee_code: 'E' + String(emps.length + 1).padStart(4, '0'), first_name: pick(FIRST), last_name: pick(LAST),
      nickname: pick(NICK), email: null, company: 'HQ', department_id: d.id, position_name: POS[lvl] + ' ' + d.name, job_level: lvl,
      manager_id: mgr, hire_date: ymd(addDays(today, -hireDaysAgo)), end_date: null,
      status: hireDaysAgo < 119 ? 'probation' : 'active', auth_user_id: null, ...extra.fields
    }
    return e
  }
  t.er_departments.forEach((d) => {
    const head = heads[d.id]
    const n = d.code.endsWith('SALES') || d.code.endsWith('PROD') || d.code.endsWith('OPS') ? 26 : 14
    for (let i = 0; i < n; i++) {
      const lvl = i < 2 ? 3 : pick([1, 1, 1, 2, 2])
      emps.push(mkEmp(d, lvl, head.id, { hireDaysAgo: i % 9 === 0 ? int(5, 100) : undefined }))
    }
    // ลาออก
    for (let i = 0; i < 2; i++) {
      const e = mkEmp(d, pick([1, 2]), head.id)
      e.status = 'resigned'; e.end_date = ymd(addDays(today, -int(3, 160)))
      emps.push(e)
    }
  })
  t.er_employees = emps
  const active = emps.filter((e) => e.status !== 'resigned')
  const others = active.filter((e) => e.id !== me.id)

  t.er_core_values = [
    ['CARE', 'ใส่ใจ', 'Care', 'ใส่ใจเพื่อนร่วมงาน ลูกค้า และสังคม เหมือนคนในครอบครัว', ['รับฟังอย่างตั้งใจ', 'ช่วยเหลือโดยไม่ต้องร้องขอ', 'ดูแลความปลอดภัยของกันและกัน'], 'HeartHandshake', '#EC4899'],
    ['TEAM', 'ร่วมมือ', 'Teamwork', 'ร่วมแรงร่วมใจ ข้ามสายงาน เพื่อเป้าหมายเดียวกัน', ['แบ่งปันข้อมูลอย่างเปิดเผย', 'ให้เครดิตทีม', 'แก้ปัญหาร่วมกัน'], 'Users', '#3B5BFD'],
    ['GROW', 'เติบโต', 'Growth', 'เรียนรู้ไม่หยุด พัฒนาตนเองและผู้อื่น', ['ขอและให้ Feedback', 'ลองสิ่งใหม่', 'สอนงานผู้อื่น'], 'Sprout', '#10B981'],
    ['TRUST', 'ซื่อตรง', 'Integrity', 'ทำสิ่งที่ถูกต้อง โปร่งใส รักษาคำพูด', ['พูดความจริงแม้ไม่ง่าย', 'รับผิดชอบต่อผลลัพธ์', 'เคารพความเป็นส่วนตัว'], 'ShieldCheck', '#8B5CF6'],
    ['INNO', 'สร้างสรรค์', 'Innovation', 'คิดต่าง ทำให้ดีกว่าเดิมทุกวัน', ['เสนอไอเดียใหม่', 'ทดลองเร็ว เรียนรู้เร็ว', 'ลดขั้นตอนที่ไม่จำเป็น'], 'Lightbulb', '#F59E0B']
  ].map(([code, name_th, name_en, description, behaviors, icon, color], i) => ({ id: id('cv'), code, name_th, name_en, description, behaviors, icon, color, sort_order: i + 1, is_active: true }))

  t.er_badges = [
    ['THANKS', 'ขอบคุณนะ', 'HandHeart', '#EC4899', 5], ['TEAM', 'Team Player', 'Users', '#3B5BFD', 10],
    ['STAR', 'Above & Beyond', 'Star', '#F59E0B', 20], ['INNOVATOR', 'Innovator', 'Lightbulb', '#F97316', 20],
    ['MENTOR', 'Great Mentor', 'GraduationCap', '#10B981', 15], ['CUSTOMER', 'Customer Hero', 'Trophy', '#8B5CF6', 20]
  ].map(([code, name, icon, color, points]) => ({ id: id('bd'), code, name, icon, color, points }))

  // Recognition
  const MSG = [
    'ขอบคุณมากที่ช่วยเตรียมงาน Town Hall จนสำเร็จ ทุกคนประทับใจมาก 🙌',
    'ช่วยทีมแก้ปัญหาระบบตอนดึก ลูกค้าไม่ได้รับผลกระทบเลย ขอบคุณจริงๆ',
    'เป็นพี่เลี้ยงน้องใหม่ได้ดีเยี่ยม น้องปรับตัวได้เร็วมาก',
    'เสนอไอเดียลดขั้นตอนอนุมัติ ช่วยประหยัดเวลาทีมไปได้เยอะ',
    'ดูแลลูกค้าอย่างใส่ใจจนได้คำชมกลับมา เป็นแบบอย่างที่ดีมาก',
    'ทำงานข้ามทีมได้ราบรื่น ประสานงานดีมากครับ',
    'ขอบคุณที่แบ่งปันความรู้ใน Knowledge Sharing สัปดาห์นี้',
    'โปรเจกต์ Green Office เดินหน้าได้เพราะคุณ ขอบคุณที่เป็นแรงบันดาลใจ'
  ]
  t.er_recognitions = Array.from({ length: 46 }, (_, i) => {
    const from = i % 6 === 0 ? me : pick(others)
    let to = pick(others); if (to.id === from.id) to = others[(others.indexOf(to) + 1) % others.length]
    const badge = pick(t.er_badges)
    return {
      id: id('rec'), from_employee_id: from.id, to_employee_id: i === 2 || i === 9 ? me.id : to.id,
      core_value_id: pick(t.er_core_values).id, badge_id: badge.id, message: pick(MSG), points: badge.points,
      visibility: 'public', created_at: iso(addDays(today, -Math.floor(i * 1.6) - rnd()))
    }
  })
  t.er_recognition_reactions = []
  t.er_recognitions.slice(0, 20).forEach((r) => {
    const n = int(1, 9)
    for (let k = 0; k < n; k++) t.er_recognition_reactions.push({ recognition_id: r.id, employee_id: others[(k * 7 + r.id.length) % others.length].id, emoji: '👏' })
  })
  t.er_awards = [
    { id: id('aw'), title: 'Employee of the Quarter', award_type: 'excellence', employee_id: others[4].id, period: 'Q3/2569', citation: 'ยอดขายเติบโต 38% และดูแลลูกค้าด้วยใจ', awarded_at: '2026-10-05' },
    { id: id('aw'), title: 'Culture Champion', award_type: 'culture', employee_id: others[12].id, period: '2569', citation: 'ขับเคลื่อนค่านิยม "ใส่ใจ" ผ่านกิจกรรมจิตอาสา 6 ครั้ง', awarded_at: '2026-09-20' },
    { id: id('aw'), title: 'Innovation Award', award_type: 'innovation', employee_id: others[20].id, period: 'Q3/2569', citation: 'พัฒนา Dashboard ลดเวลาปิดงบ 3 วัน', awarded_at: '2026-10-05' },
    { id: id('aw'), title: 'อายุงาน 10 ปี', award_type: 'service_year', employee_id: others[1].id, period: '2569', citation: 'ขอบคุณที่ร่วมเดินทางมา 10 ปี', awarded_at: '2026-11-01' }
  ]

  // สื่อสาร
  const ANN = [
    ['ก้าวสู่อนาคตไปด้วยกัน กับวิสัยทัศน์ใหม่ขององค์กร', 'สารจากผู้บริหารถึงพนักงานทุกคน เรื่องทิศทางปี 2570 และบทบาทของทุกคน', 'ceo', 'blue', true, false, -1],
    ['สิทธิประโยชน์ใหม่ปี 2570 · HR Update', 'ปรับวงเงินค่ารักษาพยาบาล เพิ่มวันลาพักร้อนตามอายุงาน และ Flexible Benefit', 'policy', 'violet', true, true, -2],
    ['โครงการเพื่อสังคม Green Office (Sustainability)', 'ชวนทุกคนร่วมลดขยะพลาสติกในออฟฟิศ 30 วัน พร้อมรางวัลทีมชนะเลิศ', 'news', 'green', false, false, -4],
    ['ยินดีต้อนรับพนักงานใหม่ประจำเดือนพฤศจิกายน', 'ทำความรู้จักเพื่อนใหม่ 14 คนที่เข้าร่วมครอบครัวเรา', 'people', 'pink', false, false, -6],
    ['Together for a Better Tomorrow · งานกิจกรรมเพื่อสังคม', 'สรุปภาพบรรยากาศกิจกรรมปลูกป่าชายเลน ร่วมกับชุมชนบางขุนเทียน', 'event', 'teal', false, false, -9],
    ['ประกาศนโยบายการทำงานแบบ Hybrid ฉบับปรับปรุง', 'มีผล 1 ธ.ค. 2569 โปรดอ่านและกดรับทราบ', 'announcement', 'amber', false, true, -12],
    ['เรื่องเล่าคนของเรา: 20 ปีกับรอยยิ้มที่หน้างาน', 'บทสัมภาษณ์คุณสมศักดิ์ หัวหน้าไลน์ผลิตผู้เป็นที่รักของทุกคน', 'people', 'pink', false, false, -15]
  ]
  t.er_announcements = ANN.map(([title, summary, category, cover_theme, is_pinned, require_ack, d]) => ({
    id: id('ann'), title, summary, body: summary + '\n\nรายละเอียดเพิ่มเติม: ' + 'ทีม HR ขอเชิญชวนพนักงานทุกท่านร่วมกันสร้างองค์กรที่ทุกคนรู้สึกเป็นส่วนหนึ่ง หากมีข้อสงสัยสามารถสอบถามผ่านเมนู "รับฟังและช่วยเหลือ" ได้ตลอดเวลา',
    category, cover_theme, cover_url: null, is_pinned, require_ack, audience: 'all', author_id: me.id, status: 'published', published_at: iso(addDays(today, d))
  }))
  t.er_announcement_reads = []
  t.er_announcements.forEach((a, i) => {
    const n = Math.floor(active.length * (0.9 - i * 0.08))
    active.slice(0, n).forEach((e) => t.er_announcement_reads.push({ announcement_id: a.id, employee_id: e.id, acknowledged: a.require_ack && rnd() > 0.2 }))
  })

  // กิจกรรม
  const EV = [
    ['Town Hall Meeting', 'ร่วมแบ่งปันวิสัยทัศน์ประจำปี 2570 และถาม-ตอบกับผู้บริหาร', 'townhall', 'blue', 20, 'ห้องประชุมใหญ่ ชั้น 12 + Online', 400, 30],
    ['Walk Together Challenge', 'เดินสะสมก้าวเป็นทีม 30 วัน เพื่อสุขภาพที่ดี', 'wellbeing', 'green', 6, 'แอป Step Tracker', null, 50],
    ['Green Office Campaign', 'ลดขยะพลาสติก แยกขยะ และปลูกต้นไม้ในออฟฟิศ', 'campaign', 'teal', 10, 'ทุกสาขา', null, 30],
    ['Volunteer Day ทำดีเพื่อสังคม', 'ร่วมปลูกป่าชายเลนกับชุมชน', 'csr', 'amber', 17, 'บางขุนเทียน', 80, 40],
    ['ปาร์ตี้ปีใหม่ 2570 "Thank You Night"', 'ฉลองความสำเร็จ มอบรางวัลพนักงานดีเด่น', 'celebration', 'pink', 34, 'โรงแรมเซ็นทารา', 1000, 20],
    ['Knowledge Sharing: AI for Everyone', 'เรียนรู้การใช้ AI ช่วยทำงานแบบง่ายๆ', 'learning', 'violet', 3, 'Online (Teams)', 200, 15],
    ['Birthday Celebration เดือนพฤศจิกายน', 'ฉลองวันเกิดเพื่อนพนักงานประจำเดือน', 'celebration', 'pink', -5, 'Pantry ชั้น 8', 60, 10],
    ['Family Day 2569', 'กิจกรรมครอบครัวพนักงาน', 'celebration', 'amber', -40, 'สวนสนุก', 800, 30]
  ]
  t.er_events = EV.map(([title, description, event_type, cover_theme, d, location, capacity, points]) => ({
    id: id('ev'), title, description, event_type, cover_theme, cover_url: null,
    start_at: iso(addDays(today, d)), end_at: iso(addDays(today, d + (event_type === 'wellbeing' || event_type === 'campaign' ? 30 : 0))),
    location, capacity, points, organizer_id: me.id, status: d < 0 ? 'completed' : 'open'
  }))
  t.er_event_participants = []
  t.er_events.forEach((ev, i) => {
    const n = Math.min(ev.capacity || 999, int(12, 90))
    active.slice(i * 3, i * 3 + n).forEach((e) => t.er_event_participants.push({
      event_id: ev.id, employee_id: e.id, status: ev.status === 'completed' ? 'attended' : 'registered',
      rating: ev.status === 'completed' ? int(3, 5) : null
    }))
  })

  // แบบสำรวจ
  const sv = { id: id('sv'), title: 'Pulse Survey ไตรมาส 4/2569', description: 'ใช้เวลา 3 นาที · ไม่ระบุตัวตน · HR เห็นเฉพาะผลรวม', survey_type: 'pulse', is_anonymous: true, min_group_size: 5, status: 'open', open_at: iso(addDays(today, -6)), close_at: iso(addDays(today, 15)) }
  const sv2 = { id: id('sv'), title: 'Engagement Survey ประจำปี 2569', description: 'แบบสำรวจความผูกพันประจำปี', survey_type: 'engagement', is_anonymous: true, min_group_size: 5, status: 'closed', open_at: iso(addDays(today, -120)), close_at: iso(addDays(today, -90)) }
  const sv3 = { id: id('sv'), title: 'Onboarding Experience (60 วัน)', description: 'สำหรับพนักงานใหม่', survey_type: 'onboarding', is_anonymous: true, min_group_size: 5, status: 'draft', open_at: null, close_at: null }
  t.er_surveys = [sv, sv2, sv3]
  const QS = [
    ['ฉันภูมิใจที่ได้บอกคนอื่นว่าทำงานที่นี่', 'likert', 'Pride'], ['หัวหน้าของฉันใส่ใจความเป็นอยู่ของฉัน', 'likert', 'Leadership'],
    ['ฉันได้รับการชื่นชมเมื่อทำงานได้ดี', 'likert', 'Recognition'], ['ฉันเห็นโอกาสเติบโตในองค์กรนี้', 'likert', 'Growth'],
    ['ฉันสามารถรักษาสมดุลชีวิตและงานได้', 'likert', 'Wellbeing'], ['ค่านิยมองค์กรสะท้อนในการทำงานจริงทุกวัน', 'likert', 'Culture'],
    ['คุณจะแนะนำบริษัทนี้ให้เพื่อนมาทำงานมากแค่ไหน (0-10)', 'nps', 'eNPS'], ['สิ่งหนึ่งที่อยากให้องค์กรเปลี่ยนแปลงคืออะไร', 'text', null]
  ]
  t.er_survey_questions = []
  ;[sv, sv2, sv3].forEach((s) => QS.forEach(([text, q_type, dimension], i) => t.er_survey_questions.push({ id: id('q'), survey_id: s.id, seq: i + 1, text, q_type, dimension, options: null })))
  t.er_survey_participation = []
  t.er_survey_responses = []
  t.er_survey_answers = []
  const bias = { Pride: 4.3, Leadership: 4.0, Recognition: 3.7, Growth: 3.5, Wellbeing: 3.6, Culture: 4.1 }
  const COMMENTS = ['อยากให้มีเส้นทางเติบโตที่ชัดเจนขึ้น', 'ขอบคุณที่ใส่ใจพนักงานเสมอ', 'อยากให้สื่อสารระหว่างฝ่ายมากขึ้น', 'อยากให้มีวัน WFH เพิ่ม', 'ระบบอนุมัติยังช้า อยากให้ลดขั้นตอน', 'หัวหน้าดีมาก รับฟังทุกความเห็น', 'อยากได้การฝึกอบรมด้าน Digital เพิ่ม']
  ;[[sv, 0.68], [sv2, 0.9]].forEach(([s, rate]) => {
    const qs = t.er_survey_questions.filter((q) => q.survey_id === s.id)
    active.filter((e) => e.id !== me.id && rnd() < rate).forEach((e) => {
      t.er_survey_participation.push({ survey_id: s.id, employee_id: e.id, submitted_at: s.open_at })
      const deptBias = (t.er_departments.findIndex((d) => d.id === e.department_id) % 4) * 0.12 - 0.15
      const r = { id: id('sr'), survey_id: s.id, employee_id: null, department_id: e.department_id, tenure_band: '1-3y', submitted_on: s.open_at.slice(0, 10) }
      t.er_survey_responses.push(r)
      qs.forEach((q) => {
        if (q.q_type === 'likert') t.er_survey_answers.push({ response_id: r.id, question_id: q.id, score: Math.max(1, Math.min(5, Math.round(bias[q.dimension] + deptBias + (rnd() - 0.5) * 2.2 - (s === sv2 ? 0.15 : 0)))) })
        else if (q.q_type === 'nps') t.er_survey_answers.push({ response_id: r.id, question_id: q.id, score: Math.max(0, Math.min(10, Math.round(8 + deptBias * 3 + (rnd() - 0.45) * 5))) })
        else if (rnd() < 0.35) t.er_survey_answers.push({ response_id: r.id, question_id: q.id, answer_text: pick(COMMENTS) })
      })
    })
  })

  // Wellbeing
  t.er_wellbeing_programs = [
    ['mental', 'Mindfulness 5 นาที', 'ฝึกหายใจและสมาธิสั้นๆ ระหว่างวันทำงาน', 'content', '5 นาที/วัน', 'violet'],
    ['mental', 'EAP ปรึกษานักจิตวิทยา (ฟรี)', 'บริการปรึกษาเป็นความลับ 24 ชม. สำหรับพนักงานและครอบครัว', 'service', '24/7', 'violet'],
    ['mental', 'Stress Management Workshop', 'เทคนิคจัดการความเครียดจากงาน', 'program', '2 ชม.', 'violet'],
    ['physical', 'Step Challenge 30 วัน', 'เดินสะสมก้าวแข่งขันเป็นทีม รับคะแนนแลกของรางวัล', 'challenge', '30 วัน', 'green'],
    ['physical', 'Healthy Recipes เมนูสุขภาพ', 'สูตรอาหารสุขภาพทำง่ายสำหรับคนทำงาน', 'content', 'อ่าน 3 นาที', 'green'],
    ['physical', 'ตรวจสุขภาพประจำปี', 'นัดหมายตรวจสุขภาพกับโรงพยาบาลคู่สัญญา', 'benefit', 'ปีละ 1 ครั้ง', 'green'],
    ['financial', 'วางแผนการเงิน & กองทุนสำรองเลี้ยงชีพ', 'เวิร์กช็อปการออมและลงทุนเพื่อเกษียณ', 'program', '2 ชม.', 'amber'],
    ['financial', 'สวัสดิการเงินกู้ดอกเบี้ยต่ำ', 'ยื่นคำขอผ่านระบบ Payroll', 'benefit', null, 'amber'],
    ['social', 'ชมรมพนักงาน (Clubs)', 'ฟุตบอล แบดมินตัน ถ่ายภาพ อาสาสมัคร', 'program', 'ทุกสัปดาห์', 'pink'],
    ['worklife', 'Flexible Work & Hybrid', 'แนวทางการทำงานยืดหยุ่นและสิทธิ์ WFH', 'benefit', null, 'blue'],
    ['worklife', 'Parental Support', 'ลาคลอด/ลาดูแลบุตร และห้องให้นมบุตร', 'benefit', null, 'blue']
  ].map(([pillar, title, description, format, duration, cover_theme]) => ({ id: id('wp'), pillar, title, description, format, duration, link_url: null, cover_theme, is_active: true }))
  t.er_wellbeing_checkins = Array.from({ length: 10 }, (_, i) => ({ id: id('wc'), employee_id: me.id, mood: int(3, 5), energy: int(2, 5), stress: int(1, 4), checkin_on: ymd(addDays(today, -i - 1)) }))

  // Voice of Employee
  const FB = [
    ['idea', 'workplace', 'อยากให้มีมุมพักผ่อน/งีบสั้นๆ ในออฟฟิศ', 'ช่วงบ่ายหลายคนเหนื่อย ถ้ามีมุมพักสั้นๆ จะช่วยให้ทำงานได้ดีขึ้น', false, 'implemented', 'ขอบคุณสำหรับไอเดีย! เราเปิด Recharge Zone ชั้น 9 แล้ว'],
    ['suggestion', 'process', 'ลดขั้นตอนการอนุมัติเบิกค่าใช้จ่าย', 'ปัจจุบันต้องผ่าน 4 ขั้น อยากให้ลดเหลือ 2 สำหรับยอดไม่เกิน 3,000 บาท', false, 'in_review', null],
    ['concern', 'manager', 'ภาระงานทีมมากเกินไปช่วงปลายปี', 'ทีมทำ OT ติดต่อกัน 3 สัปดาห์ เริ่มมีคนป่วย', true, 'answered', 'HRBP ได้นัดคุยกับหัวหน้าฝ่ายแล้ว และจะเพิ่มกำลังคนชั่วคราว'],
    ['question', 'benefit', 'สิทธิ์ประกันกลุ่มครอบคลุมทันตกรรมไหม', 'อยากทราบวงเงินและวิธีเบิก', false, 'answered', 'ครอบคลุม 3,000 บาท/ปี เบิกผ่านระบบ Payroll > สวัสดิการ'],
    ['praise', 'culture', 'ขอบคุณกิจกรรม Volunteer Day', 'ประทับใจมาก อยากให้จัดทุกไตรมาส', false, 'closed', 'ขอบคุณค่ะ จะจัดทุกไตรมาสตั้งแต่ปีหน้า'],
    ['idea', 'learning', 'อยากให้มี Mentoring Program ข้ามฝ่าย', 'ได้เรียนรู้งานฝ่ายอื่นและสร้างความสัมพันธ์', false, 'new', null],
    ['concern', 'workplace', 'แอร์ชั้น 7 เย็นไม่ทั่วถึง', 'ฝั่งหน้าต่างร้อนมากช่วงบ่าย', true, 'new', null],
    ['suggestion', 'communication', 'อยากให้สรุปข่าวองค์กรรายสัปดาห์ทาง LINE', 'อ่านง่ายกว่าอีเมล', false, 'in_review', null]
  ]
  t.er_feedback = FB.map(([feedback_type, category, subject, body, is_anonymous, status, response], i) => ({
    id: id('fb'), feedback_type, category, subject, body, is_anonymous, employee_id: is_anonymous ? null : (i === 1 ? me.id : others[i * 5].id),
    status, response, responded_by: response ? me.id : null, responded_at: response ? iso(addDays(today, -i)) : null,
    upvotes: int(0, 48), ref_code: ('FB' + (1000 + i * 37)).slice(0, 8), created_at: iso(addDays(today, -i * 3 - 1))
  }))

  // ER Cases
  const CS = [
    ['grievance', 'high', 'investigating', 'ร้องเรียนการมอบหมายงานไม่เป็นธรรม', 'hotline', 2],
    ['conflict', 'medium', 'pending_action', 'ความขัดแย้งระหว่างสมาชิกทีม', 'manager', 1],
    ['harassment', 'critical', 'investigating', 'แจ้งพฤติกรรมไม่เหมาะสมทางวาจา', 'hotline', 4],
    ['attendance', 'low', 'open', 'มาสายสะสมเกินเกณฑ์ (ข้อมูลจาก Time Attendance)', 'hr', 3],
    ['misconduct', 'high', 'resolved', 'ใช้ทรัพย์สินบริษัทโดยไม่ได้รับอนุญาต', 'manager', 6],
    ['policy', 'medium', 'closed', 'สอบถามสิทธิ์การลาตามกฎหมายแรงงาน', 'self_service', 5],
    ['performance', 'medium', 'open', 'ผลงานต่ำกว่าเป้าต่อเนื่อง 2 ไตรมาส (PIP)', 'manager', 1],
    ['grievance', 'low', 'closed', 'ร้องเรียนตารางกะทำงาน', 'feedback', 7]
  ]
  t.er_cases = CS.map(([case_type, severity, status, title, channel, di], i) => ({
    id: id('case'), case_no: 'ER-2026-' + String(31 + i).padStart(4, '0'), case_type, severity, status, title,
    description: 'รายละเอียดเคสบันทึกเป็นความลับ เฉพาะทีม ER/HR ที่ได้รับมอบหมาย', channel,
    reporter_id: others[(i * 11) % others.length].id, subject_id: others[(i * 17 + 3) % others.length].id,
    department_id: t.er_departments[di].id, assigned_to: me.id, is_confidential: true,
    due_date: ymd(addDays(today, 14 - i * 4)), resolution: status === 'resolved' || status === 'closed' ? 'ดำเนินการตามระเบียบ และติดตามผล 30 วัน' : null,
    outcome: status === 'resolved' ? 'written_warning' : status === 'closed' ? 'no_action' : null,
    opened_at: iso(addDays(today, -i * 6 - 2)), closed_at: status === 'closed' ? iso(addDays(today, -i)) : null
  }))
  t.er_case_notes = t.er_cases.flatMap((c) => [
    { id: id('cn'), case_id: c.id, author_id: me.id, note_type: 'status', body: 'เปิดเคสและแจ้งผู้เกี่ยวข้อง', created_at: c.opened_at },
    ...(c.status !== 'open' ? [{ id: id('cn'), case_id: c.id, author_id: me.id, note_type: 'interview', body: 'สัมภาษณ์ผู้ร้องและพยาน 2 ราย บันทึกถ้อยคำแล้ว', created_at: iso(addDays(new Date(c.opened_at), 2)) }] : [])
  ])

  // Journey milestones (เหมือน er_generate_milestones)
  const TPL = [
    ['onboard', 'welcome_kit', 'ส่ง Welcome Kit & แนะนำ Buddy', -3, 'hr'], ['onboard', 'day1', 'Day 1: ปฐมนิเทศ & วัฒนธรรมองค์กร', 0, 'hr'],
    ['onboard', 'day30', 'พูดคุย 30 วันกับหัวหน้า (Check-in)', 30, 'manager'], ['onboard', 'day60', 'Onboarding Pulse Survey', 60, 'employee'],
    ['onboard', 'probation', 'ประเมินผ่านทดลองงาน (119 วัน)', 110, 'manager'], ['develop', 'idp', 'จัดทำแผนพัฒนารายบุคคล (IDP)', 150, 'manager'],
    ['engage', 'anniversary_1y', 'ฉลองครบ 1 ปี', 365, 'hr'], ['retain', 'stay_interview', 'Stay Interview', 540, 'manager'],
    ['engage', 'anniversary_3y', 'ฉลองครบ 3 ปี', 1095, 'hr'], ['engage', 'anniversary_5y', 'ฉลองครบ 5 ปี · Service Award', 1826, 'hr']
  ]
  const OFF = [['exit_interview', 'Exit Interview', -7, 'hr'], ['handover', 'ส่งมอบงานและทรัพย์สิน', -3, 'manager'], ['farewell', 'Farewell with Care · ขอบคุณและอำลา', 0, 'hr'], ['alumni', 'เชิญเข้าร่วม Alumni Network', 30, 'hr']]
  t.er_journey_milestones = []
  emps.forEach((e) => {
    if (e.status === 'resigned') {
      OFF.forEach(([milestone, title, off, owner_role]) => {
        const due = addDays(new Date(e.end_date), off)
        t.er_journey_milestones.push({ id: id('jm'), employee_id: e.id, stage: 'offboard', milestone, title, due_date: ymd(due), owner_role, status: due < addDays(today, -10) ? 'done' : 'pending' })
      })
      return
    }
    TPL.forEach(([stage, milestone, title, off, owner_role]) => {
      const due = addDays(new Date(e.hire_date), off)
      const past = due < today
      t.er_journey_milestones.push({ id: id('jm'), employee_id: e.id, stage, milestone, title, due_date: ymd(due), owner_role,
        status: past ? (rnd() > 0.12 || due < addDays(today, -120) ? 'done' : 'overdue') : 'pending', completed_at: past ? iso(due) : null })
    })
  })

  const REASONS = ['career_growth', 'career_growth', 'compensation', 'manager', 'worklife', 'relocation', 'personal', 'culture']
  t.er_exit_interviews = emps.filter((e) => e.status === 'resigned').map((e) => ({
    id: id('ex'), employee_id: e.id, last_day: e.end_date, reason_primary: pick(REASONS), reason_detail: null,
    satisfaction: int(2, 5), would_return: rnd() > 0.35, would_recommend: rnd() > 0.3, regrettable: rnd() > 0.5, interviewed_by: me.id, created_at: iso(new Date(e.end_date))
  }))

  t.er_culture_stories = [
    { id: id('cs'), core_value_id: t.er_core_values[0].id, title: 'น้ำใจในวันที่น้ำท่วม', body: 'ทีมคลังสินค้ารวมตัวกันช่วยเพื่อนพนักงานที่บ้านถูกน้ำท่วม ขนของ ทำอาหาร และระดมทุนช่วยเหลือภายใน 48 ชั่วโมง', author_id: others[3].id, status: 'published', created_at: iso(addDays(today, -8)) },
    { id: id('cs'), core_value_id: t.er_core_values[4].id, title: 'ไอเดียเล็กๆ ที่ช่วยประหยัด 2 ล้าน', body: 'น้องฝ่ายผลิตเสนอปรับลำดับขั้นตอนบรรจุ ลดของเสีย 18% ต่อปี', author_id: others[8].id, status: 'published', created_at: iso(addDays(today, -20)) },
    { id: id('cs'), core_value_id: t.er_core_values[1].id, title: 'One Team ข้ามฝ่ายปิดดีลใหญ่', body: 'ฝ่ายขาย ไอที และบริการลูกค้าร่วมกันทำ POC ใน 5 วัน จนลูกค้าเลือกเรา', author_id: others[15].id, status: 'published', created_at: iso(addDays(today, -31)) }
  ]

  t.er_integrations = [
    ['HR_CORE', 'HR Core (ข้อมูลพนักงาน)', 'inbound', 'ซิงก์พนักงาน/หน่วยงาน/สายบังคับบัญชาจาก hr_db อัตโนมัติผ่าน trigger', 'connected', -0.02, emps.length],
    ['PAYROLL', 'Payroll (เงินเดือน/สวัสดิการ)', 'both', 'ส่งรางวัล/คะแนนแลกของ และรับข้อมูลเบิกสวัสดิการ ผ่าน Edge Function', 'pending', null, 0],
    ['TIME', 'Time & Attendance', 'inbound', 'ข้อมูลขาด/ลา/สาย เพื่อเป็นสัญญาณเตือน Engagement & Burnout', 'pending', null, 0],
    ['RECRUIT', 'Recruitment', 'inbound', 'ผู้สมัครที่รับเข้าทำงาน → เริ่ม Onboarding Journey', 'pending', null, 0],
    ['LND', 'L&D (การพัฒนาและฝึกอบรม)', 'inbound', 'ชั่วโมงอบรม/IDP/ใบรับรอง แสดงในหน้า Learning & Growth', 'connected', -0.5, 126],
    ['PERFORMANCE', 'Performance (ผลการประเมิน)', 'inbound', 'เป้าหมาย/Feedback เชื่อมกับ Recognition และ Analytics', 'connected', -0.5, 126]
  ].map(([system_code, name, direction, description, status, d, records]) => ({ system_code, name, direction, description, status, last_sync_at: d == null ? null : iso(addDays(today, d)), records }))
  t.er_sync_logs = [0, 1, 2].map((i) => ({ id: id('sl'), system_code: 'HR_CORE', started_at: iso(addDays(today, -i - 0.02)), finished_at: iso(addDays(today, -i - 0.02)), status: 'success', inserted: i === 2 ? 4 : 0, updated: emps.length - 2, message: 'ซิงก์จากระบบ HR Core (hr_db)' }))
  t.er_user_roles = [{ auth_user_id: 'demo', role: 'hr' }]
  return t
}

export const DEMO_TODAY = today
