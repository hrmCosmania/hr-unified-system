// =====================================================================
// Edge Function: integration-dispatch  (เรียกโดย pg_cron ทุก 5 นาที)
// อ่าน integration.outbox → ส่ง Webhook ไปยังระบบปลายทาง (Payroll, LMS, Internal Job)
// พร้อมลายเซ็น HMAC, retry แบบ exponential backoff สูงสุด 8 ครั้ง แล้วจึงเป็น 'dead'
// Secrets: SECRET_PAYROLL, SECRET_LMS, SECRET_INTERNAL_JOB (ใช้เซ็นข้อความขาออก)
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: Deno.env.get("PM_INTEGRATION_SCHEMA") ?? "pm_integration" } },
);
const MAX_ATTEMPTS = 8;
const BATCH = 100;

async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return "sha256=" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data: sources } = await db.from("sources").select("code, outbound_url, is_active");
  const urlOf = new Map((sources ?? []).filter((s) => s.is_active && s.outbound_url).map((s) => [s.code, s.outbound_url]));

  const { data: jobs, error } = await db
    .from("outbox")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("id")
    .limit(BATCH);
  if (error) return new Response(error.message, { status: 500 });

  const summary = { sent: 0, failed: 0, dead: 0, skipped: 0 };

  for (const job of jobs ?? []) {
    const url = urlOf.get(job.target);
    if (!url) { summary.skipped++; continue; }

    const body = JSON.stringify({
      event_id: `pm-${job.id}`,           // idempotency key ฝั่งปลายทาง
      event_type: job.event_type,
      occurred_at: job.created_at,
      data: job.payload,
    });
    const secret = Deno.env.get(`SECRET_${job.target.toUpperCase()}`) ?? "";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-source": "growtogether_pm", "x-signature": await sign(secret, body) },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await db.from("outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: job.attempts + 1, last_error: null }).eq("id", job.id);
      await db.from("sources").update({ last_success_at: new Date().toISOString() }).eq("code", job.target);
      summary.sent++;
    } catch (e) {
      const attempts = job.attempts + 1;
      const dead = attempts >= MAX_ATTEMPTS;
      const backoffMin = Math.min(2 ** attempts, 720);    // 2,4,8,...,สูงสุด 12 ชม.
      await db.from("outbox").update({
        status: dead ? "dead" : "failed",
        attempts,
        last_error: String(e).slice(0, 500),
        next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
      }).eq("id", job.id);
      await db.from("sources").update({ last_error_at: new Date().toISOString(), last_error: String(e).slice(0, 300) }).eq("code", job.target);
      dead ? summary.dead++ : summary.failed++;
    }
  }

  return new Response(JSON.stringify(summary), { headers: { "content-type": "application/json" } });
});
