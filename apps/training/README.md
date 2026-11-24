# PeopleGrow HRD — ระบบบริหารและพัฒนาบุคลากร

Web App สำหรับงาน HRD ของบริษัทที่มีธุรกิจ **Retail / FMCG / Factory** ฐานข้อมูลบน **Supabase** และเชื่อมโยงกับระบบ HRM อื่น ๆ (HR Core, Recruitment, Time & Attendance, Performance, Compensation & Benefits)

แนวคิด: ดูแลพนักงานตั้งแต่วันแรกที่เข้างาน (ปฐมนิเทศ, หลักสูตรภาคบังคับ) → วัดสมรรถนะเทียบตำแหน่ง → วางแผนพัฒนา (IDP 70:20:10) → อบรมและวัดผล 4 ระดับ → เห็นเส้นทางอาชีพและความพร้อมเลื่อนตำแหน่ง → Talent & Succession

---

## เริ่มใช้งาน

```powershell
cd hrd-app
npm install
npm run dev
```

เปิด http://localhost:5173 — ถ้ายังไม่ตั้งค่า Supabase ระบบจะเข้า **โหมดสาธิต** (ข้อมูลตัวอย่าง ~930 คน, 25 หลักสูตร, รุ่นอบรมทั้งปี) เลือกมุมมองได้ 3 แบบ: HR Director / หัวหน้างาน / พนักงาน
การแก้ไขในโหมดสาธิตเก็บใน browser และรีเซ็ตได้ที่ **ตั้งค่าระบบ**

## เชื่อมต่อ Supabase

1. รัน SQL ใน `supabase/migrations/` ตามลำดับ (SQL Editor หรือ `supabase db push`)
   - `001_hrd_schema.sql` — ตาราง `hrd_*` ทั้งหมด, views, Row Level Security
   - `002_hrm_integration.sql` — ฟังก์ชันเชื่อมระบบ HRM (`hrd_sync_from_hrm`, `hrd_upsert_employees`) และ view ส่งออก
2. คัดลอก `.env.example` เป็น `.env` แล้วใส่ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. สร้างผู้ใช้ใน Supabase Auth แล้วกำหนดสิทธิ์แรก (ผู้ดูแลระบบ) ด้วย SQL:
   ```sql
   insert into hrd_user_roles (auth_user_id, role) values ('<auth-user-uuid>', 'admin');
   update hrd_employees set auth_user_id = '<auth-user-uuid>' where employee_code = '<รหัสพนักงาน>';
   ```
4. ดึงข้อมูลพนักงานจาก HRM: หน้า **เชื่อมต่อระบบ HRM → HR Core → Sync ตอนนี้** (หรือ “นำเข้าข้อมูลตัวอย่าง” ในหน้าตั้งค่าเพื่อทดสอบ)

ตารางทั้งหมดใช้ prefix `hrd_` ใน schema `public` จึงติดตั้งร่วมกับฐานข้อมูล HRM เดิมได้โดยไม่ชนกัน

## โมดูล

| เมนู | ความสามารถหลัก |
|---|---|
| หน้าหลัก | KPI องค์กร/ทีม, งานที่ต้องทำ (อนุมัติ, ประเมิน L3, IDP, ใบรับรองใกล้หมดอายุ), สถิติรายเดือน, หลักสูตรยอดนิยม, ประกาศ |
| การเรียนรู้ของฉัน | Employee self-service: การลงทะเบียน, ประวัติ, ใบประกาศ, หลักสูตรแนะนำจาก Skill Gap, หลักสูตรภาคบังคับ |
| แผนพัฒนาบุคลากร (IDP) | IDP รายปี 70:20:10, workflow ร่าง → ส่ง → อนุมัติ → ติดตาม, ลงทะเบียนอบรมจาก IDP |
| หลักสูตรและอบรม | Course Catalog, ตัวกรองสายธุรกิจ, เนื้อหา/บทเรียน, เปิดรุ่น, ลงทะเบียน, หัวหน้าส่งลูกทีมเข้าอบรม |
| จัดการการอบรม | รุ่นอบรม, ปฏิทิน, อนุมัติ (ทีละรายการ/ทั้งหมด), ประเมิน L3/L4, ใบประกาศ, วิทยากร |
| เส้นทางความก้าวหน้า | Career path 7 สายงาน, เงื่อนไขเลื่อนตำแหน่ง, คะแนนความพร้อม (สมรรถนะ 50% / หลักสูตร 25% / อายุงาน 15% / ผลงาน 10%) |
| ประเมินสมรรถนะ | ประเมินตนเอง + หัวหน้า, Radar chart, Gap heatmap รายหน่วยงาน, Competency dictionary, Position matrix |
| Talent & Succession | 9-Box, Flight risk, แผนสืบทอดตำแหน่งสำคัญพร้อมระดับความพร้อม |
| รายงานและวิเคราะห์ | Kirkpatrick L1–L3, งบประมาณ vs ใช้จริง, Compliance หลักสูตรภาคบังคับ, ต้นทุน/คน, Export CSV |
| เชื่อมต่อระบบ HRM | สถานะการเชื่อมต่อ, Sync, ประวัติ Sync, ตัวอย่าง API |
| ตั้งค่าระบบ | สิทธิ์ผู้ใช้, ผูกบัญชีกับพนักงาน, งบประมาณ, ประกาศ |

## สิทธิ์การเข้าถึง (RLS)

- **admin / hr** — อ่านเขียนได้ทั้งหมด
- **manager** — เห็นข้อมูลทีมตามสายบังคับบัญชา (`manager_id` จาก HR Core), อนุมัติการอบรม/IDP ของลูกทีม
- **employee** — เห็นและแก้ไขเฉพาะของตนเอง (ลงทะเบียน, IDP, ประเมินตนเอง)

## การเชื่อมโยงกับ HRM

| ระบบ | ทิศทาง | ข้อมูล |
|---|---|---|
| HR Core | เข้า | พนักงาน, หน่วยงาน, ตำแหน่ง, หัวหน้างาน (`hrm_employee_id`, `hrm_org_unit_id`, `hrm_position_id`) |
| Recruitment | เข้า | พนักงานใหม่ → หลักสูตรปฐมนิเทศ |
| Time & Attendance | สองทาง | ชั่วโมงเข้าอบรม |
| Performance | สองทาง | ผลประเมิน KPI → Talent Review/IDP (`hrd_performance_results`) |
| Comp & Ben | ออก | ใบรับรอง/การเลื่อนตำแหน่ง (`hrd_v_export_training_history`) |

- HRM อยู่ใน Supabase project เดียวกัน → `select hrd_sync_from_hrm();` (ตั้ง pg_cron รายวันได้) — อ่านจาก `employee`, `org_unit`, `position`, `performance_review`
- HRM อยู่ที่อื่น → เรียก `POST /rest/v1/rpc/hrd_upsert_employees` ด้วย service role key จากฝั่ง server

## โครงสร้างโปรเจกต์

```
hrd-app/
├─ supabase/migrations/   SQL schema + integration
├─ src/lib/               db.js (Supabase/Demo), store.jsx, analytics.js, seed.js
├─ src/components/        Layout, UI kit, Certificate
└─ src/pages/             หน้าจอแต่ละโมดูล
```

Stack: React 18 + Vite + Tailwind CSS + Recharts + supabase-js

## ขั้นต่อไปที่แนะนำ

- Knowledge Management (คลังความรู้/วิดีโอ) และ e-Learning player พร้อมแบบทดสอบออนไลน์
- แจ้งเตือนทาง Email/LINE เมื่อมีการอนุมัติหรือใบรับรองใกล้หมดอายุ (Supabase Edge Function + pg_cron)
- สำหรับองค์กร 5,000+ คน: ย้ายการคำนวณ Dashboard ไปเป็น SQL views/materialized views แทนการโหลดทั้งตารางมาที่ browser
