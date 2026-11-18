// Click Pulse landing page: the link a hiring manager clicks from the email. One token = one answer.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zkqewnwulnugbhndtnkr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWV3bnd1bG51Z2JobmR0bmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTM5MjEsImV4cCI6MjEwMTQ4OTkyMX0.Rfo2492G7DtkhQuPfHCXCPX0jRIHUceRpDDd8AlHJh0'; // public anon key (safe by design)

function page(title, body) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{font-family:'Segoe UI',Tahoma,sans-serif;background:#e6e7eb;color:#1d2230;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
  .card{max-width:380px;padding:34px;background:#e6e7eb;border-radius:24px;box-shadow:8px 8px 18px rgba(163,170,185,.55),-8px -8px 18px rgba(255,255,255,.95)}
  .emoji{font-size:46px;margin-bottom:12px}</style></head><body><div class="card">${body}</div></body></html>`;
}

module.exports = async function handler(req, res) {
  const token = String((req.query && req.query.token) || '');
  const score = Number(req.query && req.query.score);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!/^[a-f0-9]{32}$/.test(token) || !(score >= 1 && score <= 5)) {
    res.status(400).send(page('ลิงก์ไม่ถูกต้อง', '<div class="emoji">⚠️</div><p>ลิงก์ไม่ถูกต้องหรือไม่สมบูรณ์</p>')); return;
  }
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/submit_recruit_pulse', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_score: score })
    });
    if (!r.ok) { res.status(502).send(page('เกิดข้อผิดพลาด', '<div class="emoji">⚠️</div><p>ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง</p>')); return; }
    const result = await r.json();
    if (result === 'used') { res.status(409).send(page('ตอบแบบสำรวจแล้ว', '<div class="emoji">✅</div><p>คุณได้ตอบแบบสำรวจนี้ไปแล้ว ขอบคุณสำหรับความคิดเห็นครับ</p>')); return; }
    if (result !== 'ok') { res.status(404).send(page('ไม่พบลิงก์นี้', '<div class="emoji">🔍</div><p>ไม่พบลิงก์นี้ในระบบ</p>')); return; }
    const emoji = ['😞', '🙁', '😐', '🙂', '😍'][score - 1];
    res.status(200).send(page('ขอบคุณครับ', `<div class="emoji">${emoji}</div><p>บันทึกคะแนนความพึงพอใจของคุณแล้ว<br>ขอบคุณที่สละเวลาให้ความคิดเห็นครับ</p>`));
  } catch (e) {
    res.status(500).send(page('เกิดข้อผิดพลาด', '<div class="emoji">⚠️</div><p>ระบบขัดข้องชั่วคราว</p>'));
  }
};
