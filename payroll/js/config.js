/* การเชื่อมต่อฐานข้อมูล Supabase
 * - เว้นว่างทั้งสองค่า = ใช้งานแบบเครื่องเดียว (เก็บในเบราว์เซอร์) เหมือนเดิม
 * - เปิดด้วย ?local=1 ต่อท้าย URL เพื่อบังคับใช้โหมดเครื่องเดียวชั่วคราว
 * คีย์นี้เป็นคีย์สาธารณะ (publishable) ใส่ในหน้าเว็บได้ — สิทธิ์จริงคุมด้วย Row Level Security ในฐานข้อมูล
 * ห้ามใส่ service_role / secret key ในไฟล์นี้ */
/* ใช้ฐานข้อมูลเดียวกับระบบ HR รวมศูนย์ (hr-unified-system) → ล็อกอินครั้งเดียว · ตาราง plfl_* (สร้างด้วย supabase/001_plfl_schema.sql) */
window.PL_CONFIG = {
  /* แอปย่อยของระบบ HR รวมศูนย์: ใช้ session ล็อกอินเดียวกัน (ไม่มีหน้าล็อกอินของตัวเอง) · ปุ่ม "กลับระบบ HR" · รายชื่อพนักงานจาก hr_db */
  hostApp: { name: 'ระบบ HR รวมศูนย์', url: '/', loginUrl: '/', clearKeysPrefix: 'cmncil_hr_unified_v1' },
  supabaseUrl: 'https://zkqewnwulnugbhndtnkr.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWV3bnd1bG51Z2JobmR0bmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTM5MjEsImV4cCI6MjEwMTQ4OTkyMX0.Rfo2492G7DtkhQuPfHCXCPX0jRIHUceRpDDd8AlHJh0',
};
