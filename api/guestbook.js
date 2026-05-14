// ── Vercel KV via Upstash REST API ────────────────────────────────────────────
async function kv(commands) {
  const url   = process.env.STORAGE_KV_REST_API_URL;
  const token = process.env.STORAGE_KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV env vars missing');

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV ${res.status}: ${text}`);
  }

  return res.json();
}

const MAX_NAME = 50;
const MAX_MSG  = 280;
const RATE_TTL = 600; // seconds — 1 post per 10 min per IP
const MAX_KEEP = 100; // keep last 100 entries

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: return entries ────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const result = await kv([['lrange', 'guestbook', '0', '99']]);
      const entries = (result[0]?.result || []).map(s => {
        try { return JSON.parse(s); } catch { return null; }
      }).filter(Boolean);
      return res.status(200).json(entries);
    }

    // ── POST: add entry ────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { name, message, hp } = req.body || {};

      // honeypot — bots fill this hidden field
      if (hp) return res.status(200).json({ ok: true });

      // validate
      const n = (name || '').trim().slice(0, MAX_NAME);
      const m = (message || '').trim().slice(0, MAX_MSG);
      if (!n || !m) return res.status(400).json({ error: 'name and message required' });

      // rate limit by IP
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
      const rateKey = `gb_rate:${ip}`;
      const [rateCheck] = await kv([['get', rateKey]]);
      if (rateCheck?.result) {
        return res.status(429).json({ error: 'one message per 10 minutes please' });
      }

      const entry = { name: n, message: m, date: new Date().toISOString() };

      await kv([
        ['lpush', 'guestbook', JSON.stringify(entry)],
        ['ltrim', 'guestbook', '0', String(MAX_KEEP - 1)],
        ['set', rateKey, '1', 'ex', String(RATE_TTL)]
      ]);

      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[guestbook]', err.message);
    res.status(500).json({ error: err.message });
  }
};
