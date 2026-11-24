# GrowTogether — Performance Management Platform

ระบบบริหารผลการปฏิบัติงานและพัฒนาศักยภาพพนักงาน สำหรับธุรกิจค้าปลีก · FMCG · โรงงาน
Web App (React + Vite + Tailwind) · ฐานข้อมูล Supabase (PostgreSQL + Auth + Edge Functions) · เชื่อมระบบ HRM อื่น

```
PM module/
├── docs/01-system-design.md        ← เอกสารออกแบบระบบ (โมดูล, วงจรประเมิน, สถาปัตยกรรม, Integration, RLS, Roadmap)
├── supabase/
│   ├── migrations/                 ← SQL 7 ไฟล์ (รันตามลำดับ · 0700 = งานตั้งเวลา ไม่บังคับ)
│   │   ├── …0100_core_org.sql            โครงสร้างองค์กร/พนักงาน (mirror จาก Core HR) + ฟังก์ชันสิทธิ์
│   │   ├── …0200_performance.sql         รอบประเมิน, เป้าหมาย/KPI, Check-in, Feedback, Review, 360, Calibration
│   │   ├── …0300_development.sql         Competency, Career Path, IDP, LMS, Talent pool, T&A
│   │   ├── …0400_integration.sql         Inbound staging + Outbox + pg_cron
│   │   ├── …0500_rls.sql                 Row Level Security ทุกตาราง
│   │   ├── …0600_views_analytics.sql     Views/RPC สำหรับหน้าจอและ Analytics
│   │   └── …0700_schedules.sql           (optional) pg_cron: ส่ง outbox / retry
│   ├── seed.sql                    ← ข้อมูลตั้งต้น (ตำแหน่ง, Competency, KPI Library, Career Path, รอบ 2026)
│   └── functions/
│       ├── integration-inbound/    ← รับข้อมูลจาก Core HR / Recruitment / LMS / T&A / POS / MES / QMS
│       └── integration-dispatch/   ← ส่งข้อมูลไป Payroll / LMS / Internal Job (retry อัตโนมัติ)
└── web/                            ← Web App (13 หน้าจอ)
```

## ทดลองใช้งาน (โหมด Demo — ไม่ต้องมี Supabase)

```bash
cd web && npm install && npm run dev
```
เปิด http://localhost:5173 → เลือกมุมมอง **พนักงาน / หัวหน้างาน / HR Director** ที่หน้า Login
(สลับมุมมองได้ตลอดจากมุมขวาบน)

| # | หน้าจอ | URL |
|---|---|---|
| 1 | เข้าสู่ระบบ (SSO / รหัสพนักงาน + OTP / LINE) | `#/login` |
| 2 | My Performance Hub | `#/` |
| 3 | ตั้งเป้าหมาย (Goal & KPI) · Cascade · คลัง KPI | `#/goals` |
| 4 | Check-in / Coaching | `#/checkin` |
| 5 | Feedback & Recognition Wall | `#/feedback` |
| 6 | แบบประเมิน (Self & Manager) | `#/review` |
| 7 | 360° Feedback | `#/360` |
| 8 | Competency & Career Path | `#/career` |
| 9 | IDP (70:20:10) | `#/idp` |
| 10 | ทีมของฉัน (หัวหน้า) | `#/team` |
| 11 | Calibration 9-Box (HR) — ลากวางได้ | `#/calibration` |
| 12 | Analytics (HR Director) | `#/analytics` |
| 13 | Admin + Integration Monitor | `#/admin` |

## Supabase (ติดตั้งแล้ว — 24 พ.ย. 2026)

ติดตั้งใน **ระบบ HR รวมศูนย์** (`zkqewnwulnugbhndtnkr`, ap-northeast-1) โดยแยก schema ไม่ยุ่งกับตารางเดิม:

| Schema | เนื้อหา | ใครเข้าถึงได้ |
|---|---|---|
| `pm` | 38 ตาราง + views + RPC ของระบบ PM (RLS เปิดทุกตาราง) | ผู้ใช้ที่ล็อกอิน (ผ่าน RLS) |
| `pm_integration` | sources, inbound_events, outbox | service_role (Edge Functions) เท่านั้น |

ตารางเดิมใน `public` (47 ตาราง) ไม่ถูกแก้ไข · migrations ที่รันแล้ว: `0100`–`0600` + `seed.sql`
(สร้างโปรเจกต์ใหม่ไม่ได้เพราะบัญชี Free ครบ 2 โปรเจกต์ — ถ้าอัปเกรดเป็น Pro ภายหลัง ย้ายไปโปรเจกต์แยกได้ด้วย SQL ชุดเดิม)

### ขั้นตอนที่ต้องทำใน Supabase Dashboard (ยังไม่ได้ทำ)
1. **Project Settings › Data API › Exposed schemas** → เพิ่ม `pm` (และ `pm_integration` สำหรับ Edge Functions — ปลอดภัย เพราะให้สิทธิ์เฉพาะ service_role)
2. **Authentication › Providers** → เปิด Azure (SSO สำนักงาน) และ Phone OTP (พนักงานหน้าร้าน/โรงงาน)
3. Deploy Edge Functions และตั้ง Secret ของแต่ละระบบ
   ```bash
   supabase functions deploy integration-inbound --no-verify-jwt --project-ref zkqewnwulnugbhndtnkr
   supabase functions deploy integration-dispatch --project-ref zkqewnwulnugbhndtnkr
   supabase secrets set SECRET_CORE_HR=... SECRET_POS=... SECRET_MES=... SECRET_LMS=... SECRET_PAYROLL=... --project-ref zkqewnwulnugbhndtnkr
   ```
4. เก็บ `edge_base_url` และ `service_role_key` ใน Vault แล้วรัน `supabase/migrations/20261124000700_schedules.sql` (เปิด pg_cron/pg_net + ตั้งเวลา dispatch/retry)
5. ส่งข้อมูลพนักงานจาก Core HR เข้า `integration-inbound` (event `org_unit.upserted`, `position.upserted`, `employee.upserted`) และกำหนด `pm.user_roles` ให้ HR Admin
6. เปลี่ยน `VITE_PM_MODE=live` ใน `web/.env.local` (ตอนนี้เป็น `demo` — ใช้ข้อมูลตัวอย่าง)

`web/.env.local` ตั้งค่า URL + Publishable key ของโปรเจกต์ไว้แล้ว (ไฟล์นี้อยู่ใน .gitignore)

## สถานะ
- ✅ SQL ทั้งหมดติดตั้งบน Supabase แล้ว และทดสอบ flow จริงบนฐานข้อมูล (ทดสอบแบบ rollback ไม่ทิ้งข้อมูล): Core HR sync → POS ส่งยอดขาย → เป้าหมายอัปเดตเป็น 90.42% "ตามเป้า" → ปล่อยผล → เข้าคิวส่ง Payroll
- ✅ Security Advisor: ไม่พบปัญหาใน schema `pm` / `pm_integration`
- ✅ Web App build ผ่าน (TypeScript strict) · รองรับ Desktop / Tablet / Mobile
- ⏳ หน้าจอยังแสดงข้อมูลตัวอย่าง — ฟังก์ชันเรียก Supabase อยู่ใน `web/src/data/api.ts` รอเปิด live mode
- ⏳ ยังไม่ได้ deploy Edge Functions / ตั้งเวลา pg_cron / ตั้งค่า Auth
