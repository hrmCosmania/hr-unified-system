# PeopleConnect · Employee Relation & Engagement

> คนผูกพัน องค์กรเติบโตไปด้วยกัน — Great People Make a Greater Tomorrow

Web App ด้าน Employee Relation & Engagement ที่ดูแลพนักงาน **ตั้งแต่ก่อนเข้าทำงานจนวันอำลา**
ทำงานบน **Supabase** และเชื่อมกับระบบ HRM อื่น (HR Core, L&D, Performance, Payroll, Time, Recruitment)

## เริ่มใช้งาน

```powershell
npm install
npm run dev        # เปิด http://localhost:5180
```

ถ้ายังไม่ตั้งค่า Supabase ระบบจะเปิดใน **โหมด Demo** (ข้อมูลตัวอย่าง ~190 คน เก็บในเบราว์เซอร์)
มีปุ่มสลับ "มุมมอง HR / มุมมองพนักงาน" ไว้ทดลองสิทธิ์การใช้งาน

### เชื่อม Supabase จริง
1. รัน migration ใน `supabase/migrations/` ตามลำดับ 001 → 004 (SQL Editor หรือ `supabase db push`)
2. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
3. ผู้ใช้ล็อกอินด้วยอีเมลเดียวกับใน HR Core → ระบบผูกบัญชีกับพนักงานอัตโนมัติ
4. สิทธิ์ HR ใช้ร่วมกับ `hrd_user_roles` / `plfl_profile` (admin, hr) หรือเพิ่มใน `er_user_roles`

## ฟังก์ชันหลัก (14 หน้า)

| เมนู | สิ่งที่ทำได้ |
|---|---|
| หน้าแรก | ทักทาย, Quick actions, Engagement Score, Highlights, ข่าว/กิจกรรม/สิ่งที่ต้องทำ, คำชื่นชมล่าสุด |
| People Journey | Attract → Onboard → Develop → Engage → Retain → Offboard · milestone อัตโนมัติ (Day1, 30 วัน, ผ่านทดลองงาน, IDP, ครบรอบ, Stay/Exit Interview) |
| พนักงาน | Directory ซิงก์จาก HR Core + โปรไฟล์ 360° (L&D, Performance, Journey, Recognition) |
| สื่อสารองค์กร | ข่าว/ประกาศตามหมวด, ปักหมุด, ต้องกดรับทราบ, Reaction, อัตราการอ่าน |
| กิจกรรม & แคมเปญ | สร้างกิจกรรม, ลงทะเบียน, จำกัดที่นั่ง, คะแนนสะสม, ให้คะแนนหลังกิจกรรม |
| ความผูกพัน & แบบสำรวจ | Pulse/Engagement/eNPS/Onboarding/Exit · **นิรนามระดับฐานข้อมูล** · ผลรายมิติ/หน่วยงาน (n ≥ 5) |
| การยกย่องและรางวัล | Recognition Wall ผูกกับค่านิยม, Badge + คะแนน, Leaderboard, Hall of Fame |
| สวัสดิการ & Wellbeing | 5 เสาหลัก, Mood check-in (ส่วนตัว), โปรแกรม/สวัสดิการ, เทรนด์ภาพรวมสำหรับ HR |
| วัฒนธรรมองค์กร | Vision/Mission, Core Values + พฤติกรรม, Culture Stories |
| การพัฒนาพนักงาน | ดึงข้อมูลจาก L&D (`hrd_*`) และ Performance (`pm.*`), IDP, Career Path |
| รับฟังและช่วยเหลือ | ข้อเสนอแนะ/คำถาม/ข้อกังวล (เลือกนิรนาม + รหัสติดตาม), กล่องรับเรื่องสำหรับ HR, ส่งต่อเป็น ER Case |
| ER Case Management 🔒 | Kanban เคสร้องทุกข์/ข้อพิพาท/วินัย, บันทึกการสอบสวน, ผลการพิจารณา |
| รายงาน & Analytics 🔒 | Engagement, eNPS, Turnover, Regrettable/Early leavers, สาเหตุลาออก, Heatmap & Retention Risk รายหน่วยงาน |
| ตั้งค่า & การเชื่อมต่อ 🔒 | Integration hub, ซิงก์ HR Core, แก้ไขค่านิยม, นโยบายความเป็นส่วนตัว |

## โครงสร้าง

```
supabase/migrations/
  001_er_schema.sql            ตาราง er_* ทั้งหมด
  002_er_security.sql          บทบาท + Row Level Security
  003_er_integration_rpc.sql   ซิงก์ HR Core, RPC แบบสำรวจ/feedback, เชื่อม L&D และ Performance
  004_er_seed.sql              ค่านิยม, badge, integration, โปรแกรม wellbeing, แบบสำรวจตัวอย่าง
src/
  lib/        supabase client, data layer (Supabase หรือ Demo), context
  components/ Layout, UI kit, EmployeeDrawer
  pages/      14 หน้าตามตารางด้านบน
docs/reference/   ภาพอ้างอิงการออกแบบ
```

## การเชื่อมต่อระบบ HRM

- **HR Core (`public.hr_db`)** — trigger กลาง `hr_db_sync_subapps` เรียก `er_apply_hr_db()` ทุกครั้งที่ข้อมูลพนักงานเปลี่ยน (เช่นเดียวกับ L&D และ Performance) → อัปเดตพนักงาน/หน่วยงาน/หัวหน้า/สถานะ และสร้าง Journey milestone
- **L&D / Performance** — อยู่ในโปรเจกต์ Supabase เดียวกัน อ่านผ่าน `er_lnd_summary()` / `er_perf_summary()` (security definer, เช็คสิทธิ์ตัวเอง/หัวหน้า/HR)
- **Payroll / Time & Attendance** — อยู่คนละโปรเจกต์ Supabase แนะนำให้เชื่อมผ่าน Edge Function + service key (ส่งคะแนน Recognition ไปเป็นรางวัล, รับข้อมูลขาด/ลา/สาย เป็นสัญญาณ burnout)
- **Recruitment** — ผู้สมัครที่รับเข้าทำงานจะเข้าสู่ HR Core แล้วเริ่ม Onboarding Journey อัตโนมัติ
