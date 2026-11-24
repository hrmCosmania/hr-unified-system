# GrowTogether — Performance Management Platform
### เอกสารออกแบบระบบ (System Design) · v0.1 · พ.ย. 2026

> "พัฒนาคน สร้างผลงาน เติบโตไปด้วยกัน" — ดูแลเส้นทางการเติบโตของพนักงานตั้งแต่วันแรก จนถึงความสำเร็จในอนาคต

---

## 1. เป้าหมายของระบบ

| # | เป้าหมาย | วัดผลด้วย |
|---|---|---|
| 1 | พนักงานทุกคน (สำนักงาน / สาขา / โรงงาน) มีเป้าหมายชัดเจนเชื่อมโยงกับเป้าบริษัท | % พนักงานที่ตั้งเป้าครบภายในกำหนด |
| 2 | การประเมินยุติธรรม โปร่งใส มีหลักฐาน (ข้อมูลจริงจาก POS / MES / T&A) | % KPI ที่ดึงค่าจริงอัตโนมัติ, Calibration variance |
| 3 | พัฒนาศักยภาพต่อเนื่องด้วย IDP + LMS | % พนักงานที่มี IDP, ชั่วโมงอบรม/คน |
| 4 | มองเห็นเส้นทางก้าวหน้า (Career Path) และสร้างผู้สืบทอดตำแหน่งสำคัญ | % ตำแหน่งสำคัญที่มี Successor Ready |
| 5 | ผู้บริหารตัดสินใจด้วยข้อมูล | Dashboard real‑time |

## 2. ผู้ใช้งานและสิทธิ์ (Personas & Roles)

| Role | ใคร | สิ่งที่ทำได้ |
|---|---|---|
| `employee` | พนักงานทุกคน (รวมพนักงานหน้าร้าน/สายการผลิต) | ตั้งเป้าของตนเอง, Check‑in, ให้/ขอ Feedback, ประเมินตนเอง, 360, IDP, ดู Career Path |
| `manager` | หัวหน้างานทุกระดับ (Supervisor, Store Manager, Line Leader ฯลฯ) | + อนุมัติเป้า, Coaching, ประเมินลูกทีม, ดู My Team, เข้าร่วม Calibration |
| `hrbp` | HR Business Partner ประจำ BU | + ดูข้อมูลทุกคนใน BU ที่ดูแล, จัด Calibration session |
| `hr_admin` | ทีม HR กลาง / HRIS | + ตั้งค่ารอบประเมิน, แบบฟอร์ม, Competency, Integration |
| `executive` | ผู้บริหาร / HR Director | Analytics ทั้งองค์กร (อ่านอย่างเดียว) |

> สิทธิ์ `manager` ได้มาอัตโนมัติจากโครงสร้างสายบังคับบัญชาใน Core HR (`employees.manager_id`) — ไม่ต้องกำหนดมือ

### การเข้าสู่ระบบ (รองรับพนักงานทุกกลุ่ม)
- **พนักงานสำนักงาน** — SSO (Microsoft Entra ID / Google Workspace) ผ่าน Supabase Auth (SAML/OIDC)
- **พนักงานหน้าร้าน / โรงงาน** (ไม่มีอีเมลบริษัท) — รหัสพนักงาน + OTP ทางมือถือ หรือ LINE Login
- **Kiosk ในโรงงาน** — แท็บเล็ตกลาง ล็อกอินด้วยบัตรพนักงาน (QR) + PIN, หมดเวลาอัตโนมัติ 2 นาที

## 3. ภาพรวมโมดูล (13 ฟังก์ชันหลัก)

| # | โมดูล | ผู้ใช้หลัก | คำอธิบาย |
|---|---|---|---|
| 1 | หน้าเข้าสู่ระบบ | ทุกคน | SSO / รหัสพนักงาน + OTP |
| 2 | My Performance Hub | ทุกคน | หน้าแรก: Timeline รอบประเมิน, งานที่ต้องทำ, สถานะเป้าหมาย, ทักษะที่ควรพัฒนา, เส้นทางก้าวหน้า |
| 3 | ตั้งเป้าหมาย (Goal & KPI) | ทุกคน | Cascade เป้าบริษัท → ทีม → บุคคล, KPI Library ตามสายงาน, น้ำหนักรวม 100%, ดึงค่าจริงอัตโนมัติ |
| 4 | Check‑in / Coaching | พนักงาน + หัวหน้า | บันทึกการพูดคุย 4 คำถาม, ติดตามความคืบหน้า, นัดครั้งถัดไป |
| 5 | Feedback & Recognition | ทุกคน | ให้/ขอ Feedback, ชื่นชมพร้อม Badge, Recognition Wall |
| 6 | แบบประเมิน (Self & Manager Review) | พนักงาน + หัวหน้า | ประเมิน KPI + Competency, คำนวณคะแนนตามน้ำหนัก |
| 7 | 360° Feedback | ทุกคน | เลือกผู้ประเมิน, ผลแบบ Radar (ตนเอง/หัวหน้า/เพื่อน/ลูกทีม), ปกปิดตัวตน ≥3 คน |
| 8 | Competency & Career Path | ทุกคน | เส้นทางตำแหน่ง, Gap Analysis, หลักสูตรแนะนำจาก LMS, ตำแหน่งว่างภายใน |
| 9 | IDP (แผนพัฒนารายบุคคล) | พนักงาน + หัวหน้า | แผน 70/20/10, เชื่อม LMS, ติดตามสถานะ |
| 10 | ทีมของฉัน | หัวหน้า | ภาพรวมทีม, ใครยังไม่ตั้งเป้า/ยังไม่ Check‑in, ใครเสี่ยง |
| 11 | Calibration (9‑Box) | HRBP + ผู้บริหาร | ปรับเทียบผลงาน × ศักยภาพ, Distribution Guideline |
| 12 | Analytics | HR Director / ผู้บริหาร | Completion, Rating Distribution, 9‑Box, Skill Gap ราย BU |
| 13 | Admin | HR Admin | ตั้งค่ารอบประเมิน, น้ำหนัก, Competency, Integration Monitor |

## 4. วงจรการบริหารผลงาน (Performance Cycle)

```
 ม.ค.–ก.พ.         ต่อเนื่องทุกเดือน       มิ.ย.–ก.ค.        ก.ย.–ต.ค.        พ.ย.–ธ.ค.           ธ.ค.            ม.ค. ปีถัดไป
┌──────────┐    ┌──────────────┐    ┌────────────┐   ┌───────────┐   ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐
│ ตั้งเป้า   │ →  │ Check-in /   │ →  │ Mid-year   │ → │ 360°      │ → │ Year-end     │→ │ Calibration │→ │ ส่งผลไป Payroll │
│ + อนุมัติ  │    │ Coaching     │    │ Review     │   │ Feedback  │   │ Self+Manager │  │ (9-Box)     │  │ / IDP ปีถัดไป    │
└──────────┘    └──────────────┘    └────────────┘   └───────────┘   └──────────────┘  └─────────────┘  └─────────────────┘
        ▲ Feedback & Recognition + IDP + LMS ทำได้ตลอดทั้งปี ▲
```

### น้ำหนักคะแนนตามกลุ่มพนักงาน (ตั้งค่าได้ใน Admin)

| กลุ่ม | KPI | Competency | ตัวอย่าง KPI (ดึงอัตโนมัติ) |
|---|---|---|---|
| สำนักงานใหญ่ (HQ) | 70% | 30% | ตามโครงการ / OKR (manual) |
| ค้าปลีก (Retail Store) | 60% | 40% | ยอดขายเทียบเป้า (POS), สินค้าสูญหาย %, คะแนนบริการลูกค้า, การมาทำงาน (T&A) |
| FMCG (Sales / Distribution) | 70% | 30% | Sell‑in, Numeric Distribution, OTIF |
| โรงงาน (Factory) | 50% | 50% | Output vs Plan, Yield %, Defect rate (QMS), Safety incident (MES), การมาทำงาน |

### Rating Scale (5 ระดับ) และสูตรคะแนน
```
คะแนน KPI แต่ละข้อ  = map(Actual/Target → 1–5)   (direction: มากดี / น้อยดี)
KPI Score          = Σ (คะแนนข้อ × น้ำหนักข้อ) / 100
Competency Score   = เฉลี่ย (ระดับที่ประเมิน / ระดับที่ตำแหน่งต้องการ) → 1–5
Overall            = KPI Score × w_kpi + Competency Score × w_comp
Rating             = 5 โดดเด่น | 4 เกินความคาดหวัง | 3 ตามความคาดหวัง | 2 ต้องพัฒนา | 1 ต่ำกว่ามาตรฐาน
```

## 5. สถาปัตยกรรมระบบ (Architecture)

```
                        ┌───────────────────────────── ผู้ใช้งาน ─────────────────────────────┐
                        │  Desktop (HQ)   ·   Tablet / Kiosk (โรงงาน)   ·   Mobile (หน้าร้าน)   │
                        └───────────────────────────────┬─────────────────────────────────────┘
                                                        │ HTTPS
                              ┌─────────────────────────▼──────────────────────────┐
                              │  Web App: React + Vite + TypeScript + Tailwind     │
                              │  (PWA, Responsive, ภาษาไทย/อังกฤษ)                     │
                              │  Hosting: Vercel / Netlify / Cloudflare Pages      │
                              └─────────────────────────┬──────────────────────────┘
                                                        │ supabase-js (JWT)
 ┌──────────────────────────────────────────────────────▼───────────────────────────────────────────────────┐
 │                                            SUPABASE                                                      │
 │  ┌──────────┐  ┌──────────────────────────────┐  ┌───────────────┐  ┌─────────────────────────────────┐ │
 │  │  Auth    │  │ PostgreSQL                   │  │ Storage       │  │ Edge Functions (Deno)           │ │
 │  │ SSO/OTP  │  │ • schema pm (PM data)        │  │ แนบหลักฐาน,     │  │ • integration-inbound  (รับ)     │ │
 │  │ LINE     │  │ • schema pm_integration      │  │ รูปโปรไฟล์        │  │ • integration-dispatch (ส่ง)     │ │
 │  └──────────┘  │ • RLS ทุกตาราง                 │  └───────────────┘  │ • notify (LINE/Email/Push)      │ │
 │                │ • pg_cron, pg_net, Realtime   │                     └─────────────────────────────────┘ │
 │                └──────────────────────────────┘                                                         │
 └──────────────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                 REST/Webhook (HMAC)    │    Outbox → Webhook
         ┌──────────────┬──────────────┬───────────────┼──────────────┬──────────────┬──────────────┐
     Core HR      Recruitment        LMS        Time & Attendance   Payroll/Comp    POS (Retail)   MES/QMS (Factory)
```

### หลักการออกแบบ
1. **Core HR คือ Source of Truth** ของข้อมูลพนักงาน/โครงสร้างองค์กร — PM เก็บสำเนา (mirror) ที่ sync เข้ามา ไม่แก้ไขเอง
2. **PM คือ Source of Truth** ของเป้าหมาย, ผลประเมิน, Competency assessment, IDP, 9‑Box
3. **ข้อมูลผลงานจริง (Actual)** มาจากระบบปฏิบัติการ (POS, MES, QMS, T&A) อัตโนมัติ → ลดการกรอกมือและข้อโต้แย้ง
4. **Event‑driven + Idempotent** — ทุกข้อความเข้า/ออกมี `external_id` + `event_id` ป้องกันประมวลผลซ้ำ, มี retry และ log ตรวจสอบได้
5. **Security by default** — RLS ทุกตาราง, schema `pm_integration` เข้าถึงได้เฉพาะ service_role, คีย์ระบบภายนอกเก็บแบบ hash, PDPA (ข้อมูลส่วนบุคคลน้อยที่สุด)

## 6. การเชื่อมโยงกับระบบ HRM อื่น (Integration Map)

| ระบบ | ทิศทาง | ข้อมูล | ความถี่ / กลไก | ใช้ใน PM อย่างไร |
|---|---|---|---|---|
| **Core HR** | ⬅ เข้า | พนักงาน, หน่วยงาน, ตำแหน่ง, Job grade, หัวหน้า, สถานะ (เข้า/ย้าย/ลาออก) | Webhook real‑time + Full sync ทุกคืน 02:00 | สร้าง/ย้าย Performance Plan อัตโนมัติ, สิทธิ์หัวหน้า |
| **Recruitment** | ⬅ เข้า | พนักงานใหม่, ผลสัมภาษณ์/Assessment, ตำแหน่งว่าง | Webhook เมื่อ hire | สร้างเป้าทดลองงาน (Probation 30/60/90) + IDP เริ่มต้นจากจุดที่ต้องพัฒนาตอนสัมภาษณ์ |
| **LMS** | ⬅➡ สองทาง | ⬅ Course catalog, ผลการอบรม/สอบ · ➡ คำขอลงทะเบียนจาก IDP | ⬅ Webhook เมื่อเรียนจบ · ➡ Outbox | อัปเดตสถานะ IDP อัตโนมัติ, แนะนำหลักสูตรตาม Competency gap |
| **Time & Attendance** | ⬅ เข้า | สรุปรายเดือน: วันทำงาน, สาย, ขาด, ลา, OT | Batch รายเดือน (วันที่ 3) | KPI วินัย/การมาทำงาน, ข้อมูลประกอบการประเมิน |
| **Payroll & Compensation** | ➡ ออก | Final rating, Calibrated rating, % Merit / Bonus factor ตาม Matrix | Outbox เมื่อปิดรอบ Calibration | ปรับเงินเดือน/โบนัสตามผลงาน |
| **POS (Retail)** | ⬅ เข้า | ยอดขายรายสาขา/รายพนักงาน, Basket size, สินค้าสูญหาย | Batch รายวัน (หลังปิดร้าน) | อัปเดต Actual ของ KPI ยอดขาย/Shrinkage อัตโนมัติ |
| **MES / QMS (Factory)** | ⬅ เข้า | Output, Yield, Defect, Downtime, Safety incident ราย Line/กะ | Batch รายวัน / รายกะ | อัปเดต KPI ฝ่ายผลิต รายไลน์ → รายบุคคล |
| **Internal Job / Succession** | ➡ ออก / ⬅ เข้า | ➡ Readiness, 9‑Box, Rating · ⬅ ตำแหน่งว่างภายใน | Outbox + API | แสดงตำแหน่งว่างที่เหมาะกับ Career Path, คัดผู้สมัครภายใน |

### รูปแบบ API ขาเข้า (Inbound)
```http
POST https://<project>.supabase.co/functions/v1/integration-inbound
x-source: pos
x-signature: sha256=<HMAC(body, source_secret)>
Content-Type: application/json

{
  "event_id": "pos-20261124-ST045-001",
  "event_type": "kpi.actual",
  "occurred_at": "2026-11-24T22:00:00+07:00",
  "data": [
    { "kpi_code": "RT-SALES", "scope": "org_unit", "external_ref": "ST045", "period": "2026-11", "value": 8500000 },
    { "kpi_code": "RT-SALES-EMP", "scope": "employee", "external_ref": "E10234", "period": "2026-11", "value": 412000 }
  ]
}
```
ขั้นตอน: ตรวจลายเซ็น → บันทึก `pm_integration.inbound_events` (unique `source+event_id`) → เรียก `pm_integration.process_inbound(id)` → upsert ข้อมูลปลายทาง → trigger อัปเดต Actual/Progress ของเป้าหมาย → แจ้งเตือนถ้าสถานะเปลี่ยนเป็น "เสี่ยง"

### รูปแบบขาออก (Outbound — Transactional Outbox)
1. เหตุการณ์ใน PM (เช่น ปิด Calibration) → trigger เขียน `pm_integration.outbox`
2. `pg_cron` ทุก 5 นาที เรียก Edge Function `integration-dispatch`
3. ส่ง Webhook ไประบบปลายทาง (HMAC) → สำเร็จ = `sent`, ล้มเหลว = retry แบบ exponential backoff (สูงสุด 8 ครั้ง) → `dead` + แจ้ง HRIS

### Event Catalogue

| event_type | จาก → ถึง | Payload หลัก |
|---|---|---|
| `employee.upserted` | Core HR → PM | employee_code, ชื่อ, org_unit_code, position_code, manager_code, hire_date, status |
| `employee.terminated` | Core HR → PM | employee_code, last_working_date |
| `org_unit.upserted` | Core HR → PM | code, name, parent_code, type, business_unit |
| `position.upserted` | Core HR → PM | code, title, job_family, level, grade |
| `candidate.hired` | Recruitment → PM | employee_code, assessment[{competency_code, score}] |
| `course.upserted` | LMS → PM | course_code, title, competency_codes[], hours |
| `training.completed` | LMS → PM | employee_code, course_code, completed_at, score |
| `attendance.monthly` | T&A → PM | employee_code, period, work_days, late, absent, leave |
| `kpi.actual` | POS/MES/QMS → PM | kpi_code, scope, external_ref, period, value |
| `idp.enrollment_requested` | PM → LMS | employee_code, course_code, idp_action_id |
| `performance.finalized` | PM → Payroll | employee_code, cycle, overall_score, final_rating, calibrated_rating |
| `talent.updated` | PM → Internal Job | employee_code, nine_box, readiness, target_positions[] |

## 7. โครงสร้างฐานข้อมูล (Data Model)

ดูไฟล์ SQL ฉบับเต็มใน `supabase/migrations/` — สรุปกลุ่มตาราง:

```
ORGANIZATION (mirror จาก Core HR)          PERFORMANCE                              DEVELOPMENT
├─ org_units (HQ/Region/Area/Store/        ├─ review_cycles ─┬─ cycle_phases         ├─ competencies ── competency_levels
│   Factory/Line, business_unit)           │                 └─ cycle_weight_rules   ├─ position_competencies
├─ job_families                            ├─ performance_plans (พนักงาน×รอบ)          ├─ competency_assessments
├─ positions                               │   ├─ goals ── goal_updates             ├─ career_paths ── career_path_steps
├─ employees (user_id → auth.users)        │   ├─ reviews ── review_items           ├─ idps ── idp_actions
└─ user_roles                              │   └─ checkins (+ checkin_private_notes) ├─ lms_courses ── training_records
                                           ├─ kpi_library ── kpi_actuals            └─ talent_pool (successors)
ENGAGEMENT                                 ├─ feedback_360_requests ── responses
├─ feedback (praise/constructive/request)  └─ calibration_sessions ── entries        PM_INTEGRATION (schema แยก, service‑role)
├─ notifications                                                                     ├─ sources (คีย์, endpoint, สถานะ)
└─ audit_log                               HR DATA จากระบบอื่น                         ├─ inbound_events
                                           └─ attendance_monthly                     └─ outbox
```

### Row Level Security (สรุป)
| ข้อมูล | ตนเอง | หัวหน้า (ทุกระดับในสาย) | HRBP (ใน BU) | HR Admin | Executive |
|---|---|---|---|---|---|
| เป้าหมาย / Check‑in | อ่าน‑เขียน | อ่าน‑อนุมัติ | อ่าน | ทั้งหมด | อ่าน |
| บันทึกส่วนตัวของหัวหน้า | ✗ | เฉพาะผู้เขียน | ✗ | ✗ | ✗ |
| Manager Review | อ่านเมื่อ `released` | อ่าน‑เขียน | อ่าน | ทั้งหมด | อ่าน |
| คำตอบ 360 รายคน | ✗ (เห็นค่าเฉลี่ยเมื่อ ≥3 คน) | ✗ | ✗ | อ่าน (audit) | ✗ |
| Calibration / 9‑Box | ✗ | เฉพาะ session ที่เป็นสมาชิก | อ่าน‑เขียน | ทั้งหมด | อ่าน |
| Feedback | ผู้ให้/ผู้รับ | ถ้า visibility = manager | — | ทั้งหมด | — |

## 8. UX/UI Guideline

- **Brand**: GrowTogether — Navy `#14335E` (ความน่าเชื่อถือ), Blue `#1F5FBF` (Action), Green `#1FA463` (การเติบโต), พื้นหลัง `#F3F7FB`
- **ฟอนต์**: Prompt (หัวข้อ), IBM Plex Sans Thai (เนื้อหา)
- **สถานะ** ใช้สี + ไอคอน + ข้อความเสมอ: ตามเป้า (เขียว ✓), ต้องดูแล (เหลือง !), เสี่ยง (แดง ▲)
- **Mobile‑first สำหรับพนักงานหน้าร้าน/โรงงาน**: Bottom navigation 4 เมนู (หน้าแรก / เป้าหมาย / Check‑in / โปรไฟล์), ปุ่มใหญ่ ≥44px, ฟอร์มสั้น
- **"งานที่ต้องทำ"** อยู่บนสุดของทุกบทบาท — ผู้ใช้รู้ทันทีว่าต้องทำอะไรต่อ
- **Progressive disclosure** — แบบฟอร์มประเมินเป็น Stepper ทีละขั้น บันทึกร่างอัตโนมัติ
- **ความโปร่งใส** — ทุก KPI แสดงแหล่งข้อมูล (POS/MES/Manual) และเวลาที่อัปเดตล่าสุด

## 9. แผนการพัฒนา (Roadmap)

| Phase | ระยะเวลา | ขอบเขต |
|---|---|---|
| 0 — Foundation | 4 สัปดาห์ | Supabase project, Auth (SSO + OTP), Core HR sync, RLS, Design system |
| 1 — MVP (Pilot HQ + 5 สาขา + 1 ไลน์ผลิต) | 8 สัปดาห์ | Hub, Goals, Check‑in, Feedback, Self/Manager Review, My Team |
| 2 — Data‑driven | 6 สัปดาห์ | POS/MES/QMS/T&A ingestion, KPI auto‑actual, Analytics |
| 3 — Development | 6 สัปดาห์ | Competency, 360°, IDP + LMS, Career Path, Internal Job |
| 4 — Talent | 4 สัปดาห์ | Calibration 9‑Box, Payroll outbound, Succession |
| 5 — Rollout | ต่อเนื่อง | ขยายทุกสาขา/โรงงาน, Kiosk, LINE notification, Change management |
