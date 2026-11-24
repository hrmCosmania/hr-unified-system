import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* แอปย่อยของระบบ HR รวมศูนย์: ใช้ Supabase โปรเจกต์เดียวกัน (คีย์สาธารณะเดียวกับ payroll/js/config.js)
   ใช้ storage key ค่าเริ่มต้น → session ล็อกอินเดียวกับระบบ HR (โดเมนเดียวกัน) */
const HR_URL = "https://zkqewnwulnugbhndtnkr.supabase.co";
const HR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWV3bnd1bG51Z2JobmR0bmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTM5MjEsImV4cCI6MjEwMTQ4OTkyMX0.Rfo2492G7DtkhQuPfHCXCPX0jRIHUceRpDDd8AlHJh0";
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || HR_URL;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || HR_KEY;
/** ตาราง PM อยู่ใน schema แยก "pm" (ต้องเพิ่มใน Dashboard › Data API › Exposed schemas) */
const schema = (import.meta.env.VITE_SUPABASE_SCHEMA as string | undefined) ?? "pm";

/** Supabase client — null ถ้ายังไม่ได้ใส่ URL/Key ใน .env.local */
export const supabase: SupabaseClient<any, any, any> | null =
  url && key && !url.includes("<project-ref>")
    ? createClient(url, key, { db: { schema }, auth: { persistSession: true } })
    : null;

/**
 * live = ใช้ข้อมูลและการล็อกอินจริงจาก Supabase
 * ค่าเริ่มต้นเป็น Demo (ข้อมูลตัวอย่าง) จนกว่าจะตั้ง VITE_PM_MODE=live
 * — เปิดเมื่อ sync พนักงานจาก Core HR แล้ว และตั้งค่า Auth (SSO/OTP) เรียบร้อย
 */
export const isLive = supabase !== null && import.meta.env.VITE_PM_MODE === "live";

/** ระบบแม่ (HR รวมศูนย์): ล็อกอินที่หน้า HR, ปุ่มกลับ, คีย์แคชที่ล้างตอนออกจากระบบ
 *  เปิดด้วย ?demo=1 = ใช้หน้าเข้าสู่ระบบสาธิตเดิมของแอป (ไม่ต้องล็อกอิน HR) */
export const HOST = { home: "/#home", login: "/", clearKeys: ["cmncil_hr_unified_v1", "plfl-"] };
export const hosted = supabase !== null && !(typeof location !== "undefined" && /[?&]demo=1\b/.test(location.search));

export async function hostSignOut() {
  try { await supabase?.auth.signOut(); } catch { /* ignore */ }
  try { Object.keys(localStorage).forEach((k) => { if (HOST.clearKeys.some((p) => k.startsWith(p))) localStorage.removeItem(k); }); } catch { /* ignore */ }
  location.href = HOST.login;
}
