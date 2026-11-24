import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, ShieldCheck, Smartphone, Store, Factory, ArrowRight, KeyRound } from "lucide-react";
import { useStore } from "../data/store";
import { Logo } from "../components/Layout";
import { LeafArt, MountainArt } from "../components/Art";
import { Button, cx } from "../components/ui";
import type { Role } from "../data/types";

export default function Login() {
  const { signIn, toast, live } = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sso" | "code">("sso");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const enter = (r: Role) => {
    signIn(r);
    navigate(r === "hr" ? "/analytics" : "/");
  };

  return (
    <div className="min-h-full grid lg:grid-cols-[1.1fr_1fr] bg-white">
      {/* Brand panel */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-brand-600 p-12 text-white">
        <Logo light size="lg" />
        <div className="relative z-10 max-w-lg">
          <p className="text-white/70 text-sm tracking-wide mb-3">ระบบบริหารผลการปฏิบัติงานและพัฒนาศักยภาพพนักงาน</p>
          <h1 className="font-display text-[40px] leading-[1.2] font-semibold">
            พัฒนาคน สร้างผลงาน<br /><span className="text-[#8fe3b5]">เติบโตไปด้วยกัน</span>
          </h1>
          <p className="mt-4 text-white/80 leading-relaxed">ดูแลทุกเส้นทางการเติบโตของพนักงาน ตั้งแต่วันแรก จนถึงความสำเร็จในอนาคต — ทั้งสำนักงานใหญ่ สาขา และโรงงาน</p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {[
              { icon: <Building size={18} />, t: "สำนักงานใหญ่", s: "SSO" },
              { icon: <Store size={18} />, t: "สาขาค้าปลีก", s: "มือถือ + OTP" },
              { icon: <Factory size={18} />, t: "โรงงาน", s: "Kiosk / QR" },
            ].map((x) => (
              <div key={x.t} className="rounded-xl bg-white/10 border border-white/15 p-3 backdrop-blur-sm">
                <div className="text-[#8fe3b5]">{x.icon}</div>
                <p className="mt-2 font-medium">{x.t}</p>
                <p className="text-white/60 text-xs">{x.s}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 font-display italic text-2xl text-white/90">People Grow, Business Grows.</p>
        <MountainArt className="absolute bottom-0 right-0 w-[85%] opacity-40" />
      </section>

      {/* Sign-in */}
      <section className="relative flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-[#f7fafd] to-white">
        <LeafArt className="absolute left-0 bottom-0 w-56 opacity-70" />
        <div className="w-full max-w-[400px] relative">
          <div className="lg:hidden mb-8 flex justify-center"><Logo size="lg" /></div>
          <h2 className="font-display text-[28px] font-semibold text-navy-800 text-center">ยินดีต้อนรับสู่ GrowTogether</h2>
          <p className="text-center text-ink-3 text-sm mt-1.5">ลงชื่อเข้าใช้เพื่อดูเป้าหมายและเส้นทางการเติบโตของคุณ</p>

          <div className="mt-7 grid grid-cols-2 rounded-xl bg-[#eaf0f7] p-1 text-sm">
            {([["sso", "พนักงานสำนักงาน"], ["code", "สาขา / โรงงาน"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className={cx("h-9 rounded-lg cursor-pointer", mode === k ? "bg-white shadow-sm font-semibold text-brand-700" : "text-ink-2")}>{l}</button>
            ))}
          </div>

          {mode === "sso" ? (
            <div className="mt-5 space-y-3">
              <Button className="w-full h-12 text-[15px]" onClick={() => (live ? toast("เชื่อม SSO ผ่าน Supabase Auth", "info") : enter("employee"))}>
                <ShieldCheck size={18} />เข้าสู่ระบบด้วยบัญชีองค์กร (SSO)
              </Button>
              <p className="text-xs text-center text-ink-3">Microsoft Entra ID / Google Workspace · Single Sign-On</p>
            </div>
          ) : (
            <form className="mt-5 space-y-3" onSubmit={(e) => {
              e.preventDefault();
              if (!otpSent) { if (code.trim().length < 4) return toast("กรุณากรอกรหัสพนักงาน", "crit"); setOtpSent(true); toast("ส่งรหัส OTP ไปยังเบอร์ที่ลงทะเบียน ***-***-4821", "info"); }
              else enter("employee");
            }}>
              <label className="block">
                <span className="label">รหัสพนักงาน</span>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input className="input pl-9 h-12" inputMode="numeric" placeholder="เช่น E10234" value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
              </label>
              {otpSent && (
                <label className="block fade-up">
                  <span className="label">รหัส OTP 6 หลัก</span>
                  <input className="input h-12 tracking-[0.5em] text-center text-lg" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus />
                </label>
              )}
              <Button type="submit" className="w-full h-12 text-[15px]">
                <Smartphone size={18} />{otpSent ? "ยืนยันและเข้าสู่ระบบ" : "รับรหัส OTP ทางมือถือ"}
              </Button>
              <button type="button" onClick={() => enter("employee")} className="w-full h-11 rounded-[10px] bg-[#06c755] text-white text-sm font-medium cursor-pointer hover:brightness-95">
                เข้าสู่ระบบด้วย LINE
              </button>
            </form>
          )}

          {!live && (
            <div className="mt-8 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
              <p className="text-xs font-semibold text-brand-700 mb-2">โหมด Demo — เลือกมุมมองเพื่อทดลองใช้งาน</p>
              <div className="grid grid-cols-3 gap-2">
                {([["employee", "พนักงาน"], ["manager", "หัวหน้างาน"], ["hr", "HR Director"]] as [Role, string][]).map(([r, l]) => (
                  <button key={r} onClick={() => enter(r)} className="h-9 rounded-lg bg-white border border-brand-100 text-[13px] text-brand-700 hover:border-brand-500 cursor-pointer inline-flex items-center justify-center gap-1">
                    {l}<ArrowRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-8 text-center text-xs text-ink-3">ข้อมูลของคุณได้รับการคุ้มครองตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
        </div>
      </section>
    </div>
  );
}
