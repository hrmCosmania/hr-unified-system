// Resume OCR for the Recruitment module. Receives a PDF/image (base64) from the logged-in HR app and returns
// structured candidate data. Only callers holding a valid Supabase login token are served.
//
// Configure ONE of these in the Vercel project's Environment Variables:
//   GEMINI_API_KEY     (free tier: https://aistudio.google.com/apikey)  — preferred
//   ANTHROPIC_API_KEY  (https://console.anthropic.com/settings/keys)    — used when GEMINI_API_KEY is blank
// Optional: GEMINI_MODEL (default gemini-flash-latest), OCR_MODEL (default claude-sonnet-5-5)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zkqewnwulnugbhndtnkr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWV3bnd1bG51Z2JobmR0bmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTM5MjEsImV4cCI6MjEwMTQ4OTkyMX0.Rfo2492G7DtkhQuPfHCXCPX0jRIHUceRpDDd8AlHJh0'; // public anon key (safe by design)

const PROMPT = `อ่านเรซูเม่นี้แล้วดึงข้อมูลออกมาเป็น JSON ตาม schema ต่อไปนี้เท่านั้น ห้ามมีข้อความอื่นนอก JSON:
{
  "first_name": "", "last_name": "", "email": "", "phone": "",
  "current_job": "", "current_company": "", "exp_years": 0,
  "skills": ["..."], "education": "สรุปวุฒิการศึกษาสั้นๆ", "summary": "สรุปประสบการณ์ 1-2 ประโยค"
}
ถ้าอ่านข้อมูลส่วนไหนไม่ได้ให้ใส่ค่าว่าง "" หรือ 0 สำหรับตัวเลข`;

function parseJson(text) {
  try { return JSON.parse(String(text).trim().replace(/^```json\s*|```$/g, '')); } catch (e) { return null; }
}

async function withGemini(mime, data) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data } }, { text: PROMPT }] }], generationConfig: { responseMimeType: 'application/json' } })
  });
  if (!r.ok) return { status: 'failed' };
  const j = await r.json();
  const extracted = parseJson(j.candidates?.[0]?.content?.parts?.[0]?.text || '');
  return extracted ? { status: 'done', extracted } : { status: 'failed' };
}

async function withClaude(mime, data) {
  const block = mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data } };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.OCR_MODEL || 'claude-sonnet-5-5', max_tokens: 1024, messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }] })
  });
  if (!r.ok) return { status: 'failed' };
  const j = await r.json();
  const extracted = parseJson((j.content || []).map(c => c.text || '').join(''));
  return extracted ? { status: 'done', extracted } : { status: 'failed' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ status: 'failed', error: 'method' }); return; }
  try {
    const auth = String(req.headers.authorization || '');
    if (!/^Bearer .+/.test(auth)) { res.status(401).json({ status: 'failed', error: 'unauthorized' }); return; }
    // Verify the caller is a logged-in Supabase user (anon key is public; the user token is what proves login).
        const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } });
    if (!who.ok) { res.status(401).json({ status: 'failed', error: 'unauthorized' }); return; }

    const { mime, data } = req.body || {};
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!data || !allowed.includes(mime)) { res.status(400).json({ status: 'failed', error: 'unsupported file' }); return; }
    if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) { res.status(200).json({ status: 'not_configured' }); return; }

    const out = process.env.GEMINI_API_KEY ? await withGemini(mime, data) : await withClaude(mime, data);
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ status: 'failed' });
  }
};
