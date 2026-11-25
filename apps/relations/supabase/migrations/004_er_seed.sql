-- =====================================================================
-- PeopleConnect ER — ข้อมูลตั้งต้น (แก้ไขได้ภายหลังในหน้า ตั้งค่าระบบ)
-- =====================================================================

insert into er_core_values (code, name_th, name_en, description, behaviors, icon, color, sort_order) values
 ('CARE',  'ใส่ใจ',      'Care',       'ใส่ใจเพื่อนร่วมงาน ลูกค้า และสังคม เหมือนคนในครอบครัว',
   array['รับฟังอย่างตั้งใจ','ช่วยเหลือโดยไม่ต้องร้องขอ','ดูแลความปลอดภัยของกันและกัน'], 'HeartHandshake', '#EC4899', 1),
 ('TEAM',  'ร่วมมือ',     'Teamwork',   'ร่วมแรงร่วมใจ ข้ามสายงาน เพื่อเป้าหมายเดียวกัน',
   array['แบ่งปันข้อมูลอย่างเปิดเผย','ให้เครดิตทีม','แก้ปัญหาร่วมกัน'], 'Users', '#3B5BFD', 2),
 ('GROW',  'เติบโต',      'Growth',     'เรียนรู้ไม่หยุด พัฒนาตนเองและผู้อื่น',
   array['ขอและให้ Feedback','ลองสิ่งใหม่','สอนงานผู้อื่น'], 'Sprout', '#10B981', 3),
 ('TRUST', 'ซื่อตรง',     'Integrity',  'ทำสิ่งที่ถูกต้อง โปร่งใส รักษาคำพูด',
   array['พูดความจริงแม้ไม่ง่าย','รับผิดชอบต่อผลลัพธ์','เคารพความเป็นส่วนตัว'], 'ShieldCheck', '#8B5CF6', 4),
 ('INNO',  'สร้างสรรค์',  'Innovation', 'คิดต่าง ทำให้ดีกว่าเดิมทุกวัน',
   array['เสนอไอเดียใหม่','ทดลองเร็ว เรียนรู้เร็ว','ลดขั้นตอนที่ไม่จำเป็น'], 'Lightbulb', '#F59E0B', 5)
on conflict (code) do nothing;

insert into er_badges (code, name, icon, color, points) values
 ('THANKS',   'ขอบคุณนะ',          'HandHeart',  '#EC4899', 5),
 ('TEAM',     'Team Player',        'Users',      '#3B5BFD', 10),
 ('STAR',     'Above & Beyond',     'Star',       '#F59E0B', 20),
 ('INNOVATOR','Innovator',          'Lightbulb',  '#F97316', 20),
 ('MENTOR',   'Great Mentor',       'GraduationCap','#10B981', 15),
 ('CUSTOMER', 'Customer Hero',      'Trophy',     '#8B5CF6', 20)
on conflict (code) do nothing;

insert into er_integrations (system_code, name, direction, description, status) values
 ('HR_CORE',     'HR Core (ข้อมูลพนักงาน)',        'inbound',  'ซิงก์พนักงาน/หน่วยงาน/สายบังคับบัญชาจาก hr_db อัตโนมัติผ่าน trigger', 'pending'),
 ('PAYROLL',     'Payroll (เงินเดือน/สวัสดิการ)',  'both',     'ส่งรางวัล/คะแนนแลกของ และรับข้อมูลเบิกสวัสดิการ ผ่าน Edge Function', 'pending'),
 ('TIME',        'Time & Attendance',              'inbound',  'ข้อมูลขาด/ลา/สาย เพื่อเป็นสัญญาณเตือน Engagement & Burnout', 'pending'),
 ('RECRUIT',     'Recruitment',                    'inbound',  'ผู้สมัครที่รับเข้าทำงาน → เริ่ม Onboarding Journey', 'pending'),
 ('LND',         'L&D (การพัฒนาและฝึกอบรม)',       'inbound',  'ชั่วโมงอบรม/IDP/ใบรับรอง แสดงในหน้า Learning & Growth', 'connected'),
 ('PERFORMANCE', 'Performance (ผลการประเมิน)',     'inbound',  'เป้าหมาย/Feedback เชื่อมกับ Recognition และ Analytics', 'connected')
on conflict (system_code) do nothing;

insert into er_wellbeing_programs (pillar, title, description, format, duration, cover_theme) values
 ('mental',   'Mindfulness 5 นาที',          'ฝึกหายใจและสมาธิสั้นๆ ระหว่างวันทำงาน',                  'content',  '5 นาที/วัน', 'violet'),
 ('mental',   'EAP ปรึกษานักจิตวิทยา (ฟรี)',  'บริการปรึกษาเป็นความลับ 24 ชม. สำหรับพนักงานและครอบครัว', 'service',  '24/7',       'violet'),
 ('physical', 'Step Challenge 30 วัน',        'เดินสะสมก้าวแข่งขันเป็นทีม รับคะแนนแลกของรางวัล',       'challenge','30 วัน',     'green'),
 ('physical', 'ตรวจสุขภาพประจำปี',            'นัดหมายตรวจสุขภาพกับโรงพยาบาลคู่สัญญา',                 'benefit',  'ปีละ 1 ครั้ง','green'),
 ('financial','วางแผนการเงิน & กองทุนสำรองเลี้ยงชีพ','เวิร์กช็อปการออมและลงทุนเพื่อเกษียณ',              'program',  '2 ชม.',      'amber'),
 ('financial','สวัสดิการเงินกู้ดอกเบี้ยต่ำ',   'เชื่อมกับระบบ Payroll เพื่อยื่นคำขอ',                    'benefit',  null,         'amber'),
 ('social',   'ชมรมพนักงาน (Clubs)',          'ฟุตบอล แบดมินตัน ถ่ายภาพ อาสาสมัคร',                     'program',  'ทุกสัปดาห์', 'pink'),
 ('worklife', 'Flexible Work & Hybrid',       'แนวทางการทำงานยืดหยุ่นและสิทธิ์ WFH',                    'benefit',  null,         'blue')
on conflict do nothing;

-- แบบสำรวจตัวอย่าง: Pulse รายไตรมาส (ฉบับร่าง)
-- เพิ่มครั้งเดียว (รันซ้ำไม่สร้างซ้ำ)
with s as (
  insert into er_surveys (title, description, survey_type, is_anonymous, status, open_at, close_at)
  values ('Pulse Survey ไตรมาส 4/2569', 'ใช้เวลา 3 นาที · ไม่ระบุตัวตน · ผลรวมเท่านั้นที่ HR เห็น', 'pulse', true, 'draft', null, null)  -- ระบบ HR รวมศูนย์: เริ่มเป็นฉบับร่าง HR เปิดเองเมื่อพร้อม
  returning id
)
insert into er_survey_questions (survey_id, seq, text, q_type, dimension)
select s.id, q.seq, q.text, q.q_type, q.dim from s cross join (values
 (1, 'ฉันภูมิใจที่ได้บอกคนอื่นว่าทำงานที่นี่', 'likert', 'Pride'),
 (2, 'หัวหน้าของฉันใส่ใจความเป็นอยู่ของฉัน', 'likert', 'Leadership'),
 (3, 'ฉันได้รับการชื่นชมเมื่อทำงานได้ดี', 'likert', 'Recognition'),
 (4, 'ฉันเห็นโอกาสเติบโตในองค์กรนี้', 'likert', 'Growth'),
 (5, 'ฉันสามารถรักษาสมดุลชีวิตและงานได้', 'likert', 'Wellbeing'),
 (6, 'ค่านิยมองค์กรสะท้อนในการทำงานจริงทุกวัน', 'likert', 'Culture'),
 (7, 'คุณจะแนะนำบริษัทนี้ให้เพื่อนมาทำงานมากแค่ไหน (0-10)', 'nps', 'eNPS'),
 (8, 'สิ่งหนึ่งที่อยากให้องค์กรเปลี่ยนแปลงคืออะไร', 'text', null)
) as q(seq, text, q_type, dim);
