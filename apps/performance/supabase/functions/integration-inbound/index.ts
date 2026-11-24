// =====================================================================
// Edge Function: integration-inbound
// รับข้อมูลจากระบบ HRM/ปฏิบัติการ (Core HR, Recruitment, LMS, T&A, POS, MES, QMS, Internal Job)
//
//   POST /functions/v1/integration-inbound
//   Headers: x-source: <code>, x-signature: sha256=<hex HMAC-SHA256(body, SECRET_<CODE>)>
//   Body:    { event_id, event_type, occurred_at, data }
//
// ขั้นตอน: ตรวจลายเซ็น → บันทึก staging (idempotent) → ประมวลผลด้วย integration.process_inbound()
// Secrets: supabase secrets set SECRET_POS=... SECRET_CORE_HR=... (หนึ่งค่าต่อระบบ)
// Deploy:  supabase functions deploy integration-inbound --no-verify-jwt
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: Deno.env.get("PM_INTEGRATION_SCHEMA") ?? "pm_integration" } },
);

const ALLOWED_EVENTS: Record<string, string[]> = {
  core_hr: ["employee.upserted", "employee.terminated", "org_unit.upserted", "position.upserted"],
  recruitment: ["candidate.hired", "internal_job.upserted"],
  internal_job: ["internal_job.upserted"],
  lms: ["course.upserted", "training.completed", "training.updated"],
  tna: ["attendance.monthly"],
  pos: ["kpi.actual"],
  mes: ["kpi.actual"],
  qms: ["kpi.actual"],
};

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const source = req.headers.get("x-source") ?? "";
  const signature = (req.headers.get("x-signature") ?? "").replace(/^sha256=/, "");
  const secret = Deno.env.get(`SECRET_${source.toUpperCase()}`);
  if (!ALLOWED_EVENTS[source] || !secret) return json(401, { error: "unknown_source" });

  const raw = await req.text();
  if (!timingSafeEqual(await hmacHex(secret, raw), signature)) return json(401, { error: "invalid_signature" });

  let body: { event_id?: string; event_type?: string; data?: unknown };
  try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const { event_id, event_type, data } = body;
  if (!event_id || !event_type || data === undefined) return json(400, { error: "missing_fields" });
  if (!ALLOWED_EVENTS[source].includes(event_type)) return json(422, { error: "event_not_allowed_for_source" });

  // 1) staging (unique source+event_id → ส่งซ้ำได้อย่างปลอดภัย)
  const { data: row, error } = await supabase
    .from("inbound_events")
    .upsert({ source, event_id, event_type, payload: body }, { onConflict: "source,event_id", ignoreDuplicates: false })
    .select("id, status")
    .single();
  if (error) return json(500, { error: error.message });
  if (row.status === "processed") return json(200, { status: "duplicate", id: row.id });

  // 2) ประมวลผล
  const { data: result, error: procErr } = await supabase.rpc("process_inbound", { p_id: row.id });
  if (procErr) return json(500, { error: procErr.message, id: row.id });

  const ok = typeof result === "string" && !result.startsWith("failed");
  return json(ok ? 200 : 202, { status: result, id: row.id });
});
