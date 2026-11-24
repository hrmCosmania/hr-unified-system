set search_path = pm, public, extensions;
-- =====================================================================
-- GrowTogether PM · ข้อมูลตั้งต้น (Reference data) — รันหลัง migrations
-- ข้อมูลพนักงานจริงจะมาจาก Core HR ผ่าน integration-inbound
-- =====================================================================

-- Job families
insert into pm.job_families (code, name_th, business_unit) values
  ('RETAIL-OPS', 'ปฏิบัติการสาขา', 'retail'),
  ('PRODUCTION', 'การผลิต', 'factory'),
  ('QUALITY', 'ควบคุมคุณภาพ', 'factory'),
  ('FMCG-SALES', 'ขาย FMCG', 'fmcg'),
  ('HQ-SUPPORT', 'สนับสนุนสำนักงานใหญ่', 'hq')
on conflict (code) do nothing;

-- Positions (ตัวอย่างสายค้าปลีก + โรงงาน)
insert into pm.positions (code, title_th, title_en, job_family_id, job_level, is_people_manager, is_critical)
select v.code, v.th, v.en, jf.id, v.lvl, v.mgr, v.crit
from (values
  ('RT-S1', 'พนักงานขาย', 'Sales Staff', 'RETAIL-OPS', 1, false, false),
  ('RT-S2', 'พนักงานขายอาวุโส', 'Senior Sales Staff', 'RETAIL-OPS', 2, false, false),
  ('RT-S3', 'หัวหน้างานสาขา', 'Store Supervisor', 'RETAIL-OPS', 3, true, false),
  ('RT-M1', 'ผู้ช่วยผู้จัดการสาขา', 'Assistant Store Manager', 'RETAIL-OPS', 4, true, false),
  ('RT-M2', 'ผู้จัดการสาขา', 'Store Manager', 'RETAIL-OPS', 5, true, true),
  ('RT-M3', 'ผู้จัดการเขต', 'Area Manager', 'RETAIL-OPS', 6, true, true),
  ('FC-O1', 'พนักงานฝ่ายผลิต', 'Operator', 'PRODUCTION', 1, false, false),
  ('FC-O2', 'พนักงานฝ่ายผลิตอาวุโส', 'Senior Operator', 'PRODUCTION', 2, false, false),
  ('FC-L1', 'หัวหน้าไลน์', 'Line Leader', 'PRODUCTION', 3, true, false),
  ('FC-S1', 'หัวหน้างานฝ่ายผลิต', 'Production Supervisor', 'PRODUCTION', 4, true, false),
  ('FC-M1', 'ผู้จัดการฝ่ายผลิต', 'Production Manager', 'PRODUCTION', 5, true, true),
  ('FC-M2', 'ผู้จัดการโรงงาน', 'Plant Manager', 'PRODUCTION', 7, true, true)
) as v(code, th, en, fam, lvl, mgr, crit)
join pm.job_families jf on jf.code = v.fam
on conflict (code) do nothing;

-- Competencies
insert into pm.competencies (code, name_th, name_en, category) values
  ('CORE-CUST',   'มุ่งเน้นลูกค้า', 'Customer Focus', 'core'),
  ('CORE-TEAM',   'ทำงานเป็นทีม', 'Teamwork', 'core'),
  ('CORE-INTEG',  'ซื่อสัตย์และรับผิดชอบ', 'Integrity & Ownership', 'core'),
  ('LEAD-COACH',  'การสอนงานและพัฒนาทีม', 'Coaching & Developing Others', 'leadership'),
  ('LEAD-COMM',   'การสื่อสาร', 'Communication', 'leadership'),
  ('FN-STOREOPS', 'การบริหารงานสาขา', 'Store Operations', 'functional'),
  ('FN-PNL',      'การบริหารกำไร-ขาดทุนสาขา', 'Store P&L Management', 'functional'),
  ('FN-DATA',     'การวิเคราะห์ข้อมูลการขาย', 'Sales Data Analysis', 'functional'),
  ('FN-LEAN',     'Lean / การลดความสูญเปล่า', 'Lean Manufacturing', 'functional'),
  ('FN-SAFETY',   'ความปลอดภัยในการทำงาน', 'Workplace Safety', 'functional'),
  ('FN-KAM',      'การบริหารลูกค้าหลัก', 'Key Account Management', 'functional')
on conflict (code) do nothing;

insert into pm.competency_levels (competency_id, level, title_th)
select c.id, l.level, l.title from pm.competencies c
cross join (values (1,'เริ่มต้น'),(2,'พื้นฐาน'),(3,'ชำนาญ'),(4,'เชี่ยวชาญ'),(5,'ต้นแบบ')) as l(level, title)
on conflict do nothing;

-- Required levels: Store Supervisor & Assistant Store Manager
insert into pm.position_competencies (position_id, competency_id, required_level)
select p.id, c.id, v.lvl from (values
  ('RT-S3','CORE-CUST',4),('RT-S3','CORE-TEAM',4),('RT-S3','CORE-INTEG',4),('RT-S3','LEAD-COACH',3),('RT-S3','LEAD-COMM',3),('RT-S3','FN-STOREOPS',3),('RT-S3','FN-DATA',2),
  ('RT-M1','CORE-CUST',4),('RT-M1','CORE-TEAM',4),('RT-M1','CORE-INTEG',4),('RT-M1','LEAD-COACH',4),('RT-M1','LEAD-COMM',3),('RT-M1','FN-STOREOPS',4),('RT-M1','FN-PNL',4),('RT-M1','FN-DATA',3),
  ('FC-L1','CORE-TEAM',4),('FC-L1','CORE-INTEG',4),('FC-L1','FN-LEAN',3),('FC-L1','FN-SAFETY',4),('FC-L1','LEAD-COACH',3)
) as v(pos, comp, lvl)
join pm.positions p on p.code = v.pos
join pm.competencies c on c.code = v.comp
on conflict do nothing;

-- KPI library
insert into pm.kpi_library (code, name_th, unit, direction, data_source, aggregation, business_unit) values
  ('RT-SALES',     'ยอดขายเทียบเป้า', 'บาท', 'higher_better', 'pos', 'sum', 'retail'),
  ('RT-SHRINK',    'สินค้าสูญหาย (Shrinkage)', '%', 'lower_better', 'pos', 'avg', 'retail'),
  ('RT-CSAT',      'คะแนนความพึงพอใจลูกค้า', 'คะแนน', 'higher_better', 'crm', 'avg', 'retail'),
  ('RT-STOCK-ACC', 'ความถูกต้องของสต็อก', '%', 'higher_better', 'pos', 'last', 'retail'),
  ('FC-OUTPUT',    'ผลผลิตเทียบแผน', '%', 'higher_better', 'mes', 'avg', 'factory'),
  ('FC-YIELD',     'Yield การผลิต', '%', 'higher_better', 'mes', 'avg', 'factory'),
  ('FC-DEFECT',    'อัตราของเสีย', '%', 'lower_better', 'qms', 'avg', 'factory'),
  ('SAFE-LTI',     'อุบัติเหตุถึงขั้นหยุดงาน', 'ครั้ง', 'lower_better', 'mes', 'sum', 'factory'),
  ('FM-SELLIN',    'ยอด Sell-in เทียบเป้า', 'บาท', 'higher_better', 'crm', 'sum', 'fmcg'),
  ('HR-ATTEND',    'การมาทำงาน (ไม่ขาด/สาย)', '%', 'higher_better', 'tna', 'avg', null),
  ('LMS-SERVICE',  'ทีมผ่านหลักสูตรมาตรฐานบริการ', '%', 'higher_better', 'lms', 'last', 'retail')
on conflict (code) do nothing;

-- Career paths
insert into pm.career_paths (code, name_th, job_family_id, business_unit)
select v.code, v.name, jf.id, v.bu::business_unit from (values
  ('RETAIL-STORE', 'เส้นทางปฏิบัติการสาขา', 'RETAIL-OPS', 'retail'),
  ('FACTORY-PROD', 'เส้นทางการผลิต', 'PRODUCTION', 'factory')
) as v(code, name, fam, bu) join pm.job_families jf on jf.code = v.fam
on conflict (code) do nothing;

insert into pm.career_path_steps (path_id, position_id, step_order, min_tenure_months, min_rating, required_course_codes)
select cp.id, p.id, v.ord, v.tenure, v.rating, v.courses from (values
  ('RETAIL-STORE','RT-S1',1,12,3,'{}'::text[]), ('RETAIL-STORE','RT-S2',2,18,3,'{}'),
  ('RETAIL-STORE','RT-S3',3,24,4,'{RT-LEAD-01}'), ('RETAIL-STORE','RT-M1',4,24,4,'{RT-LEAD-01,RT-PNL-01}'),
  ('RETAIL-STORE','RT-M2',5,24,4,'{RT-PNL-01}'), ('RETAIL-STORE','RT-M3',6,36,4,'{}'),
  ('FACTORY-PROD','FC-O1',1,12,3,'{SAFE-01}'), ('FACTORY-PROD','FC-O2',2,18,3,'{SAFE-01}'),
  ('FACTORY-PROD','FC-L1',3,24,4,'{LEAN-01}'), ('FACTORY-PROD','FC-S1',4,24,4,'{LEAN-02}'),
  ('FACTORY-PROD','FC-M1',5,36,4,'{}'), ('FACTORY-PROD','FC-M2',6,48,4,'{}')
) as v(path, pos, ord, tenure, rating, courses)
join pm.career_paths cp on cp.code = v.path
join pm.positions p on p.code = v.pos
on conflict do nothing;

-- Review cycle 2026
with c as (
  insert into pm.review_cycles (code, name_th, year, start_date, end_date, status)
  values ('PMS-2026', 'ประเมินผล 2026', 2026, '2026-01-01', '2026-12-31', 'active')
  on conflict (code) do update set status = excluded.status
  returning id
)
insert into pm.cycle_phases (cycle_id, phase, start_date, end_date, sort_order)
select c.id, v.phase::cycle_phase, v.s::date, v.e::date, v.o from c, (values
  ('goal_setting','2026-01-01','2026-02-15',1), ('checkin','2026-02-16','2026-12-15',2),
  ('mid_year','2026-07-01','2026-07-31',3), ('feedback_360','2026-10-01','2026-10-31',4),
  ('year_end','2026-11-16','2026-12-15',5), ('calibration','2026-12-16','2026-12-23',6),
  ('result','2027-01-05','2027-01-15',7)
) as v(phase, s, e, o)
on conflict do nothing;

insert into pm.cycle_weight_rules (cycle_id, employee_group, kpi_weight, competency_weight, min_goals, max_goals)
select rc.id, v.g::employee_group, v.k, v.c, v.mn, v.mx
from pm.review_cycles rc, (values ('office',70,30,3,7), ('store',60,40,3,6), ('field_sales',70,30,3,6), ('factory',50,50,3,5)) as v(g,k,c,mn,mx)
where rc.code = 'PMS-2026';
