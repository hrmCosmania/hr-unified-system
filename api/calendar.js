// Serves the HR calendar subscription feed (iCalendar). The feed text is stored by the HR app in Supabase
// and is only readable by someone who knows the secret token. Uses the public anon key (safe by design).
const SUPABASE_URL = 'https://zkqewnwulnugbhndtnkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcWV3bnd1bG51Z2JobmR0bmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTM5MjEsImV4cCI6MjEwMTQ4OTkyMX0.Rfo2492G7DtkhQuPfHCXCPX0jRIHUceRpDDd8AlHJh0';

module.exports = async function handler(req, res) {
  const token = String((req.query && req.query.token) || '');
  if (!/^[a-f0-9]{48}$/.test(token)) { res.status(404).send('Not found'); return; }
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_calendar_feed', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token })
    });
    if (!r.ok) { res.status(502).send('Upstream error'); return; }
    const ics = await r.json();
    if (!ics) { res.status(404).send('Not found'); return; }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="hr-calendar.ics"');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).send(ics);
  } catch (e) {
    res.status(500).send('Error');
  }
};
