// ── Vercel KV via Upstash REST API ────────────────────────────────────────────
async function kv(commands) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV env vars missing');
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`KV ${res.status}: ${t}`); }
  return res.json();
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'game';
}

const MAX_TITLE  = 50;
const MAX_AUTHOR = 50;
const MAX_CODE   = 8000;
const RATE_TTL   = 3600; // 1 hour
const MAX_KEEP   = 50;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const reqUrl = new URL(req.url, 'https://placeholder');
  const id = reqUrl.searchParams.get('id');

  try {
    // ── GET list (no code) ────────────────────────────────────────────────────
    if (req.method === 'GET' && !id) {
      const result = await kv([['lrange', 'arcade', '0', String(MAX_KEEP - 1)]]);
      const games = (result[0]?.result || []).map(s => {
        try { const g = JSON.parse(s); return { id: g.id, title: g.title, author: g.author, date: g.date }; }
        catch { return null; }
      }).filter(Boolean);
      return res.status(200).json(games);
    }

    // ── GET single game by id (includes code) ────────────────────────────────
    if (req.method === 'GET' && id) {
      const result = await kv([['lrange', 'arcade', '0', String(MAX_KEEP - 1)]]);
      const all = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
      const game = all.find(g => g.id === id);
      if (!game) return res.status(404).json({ error: 'game not found' });
      return res.status(200).json(game);
    }

    // ── POST: submit a game ───────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { title, author, code, hp } = req.body || {};
      if (hp) return res.status(200).json({ ok: true }); // honeypot

      const t = (title  || '').trim().slice(0, MAX_TITLE);
      const a = (author || '').trim().slice(0, MAX_AUTHOR);
      const c = (code   || '').trim().slice(0, MAX_CODE);
      if (!t || !a || !c) return res.status(400).json({ error: 'title, author, and code are all required' });

      const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
      const rateKey = `arcade_rate:${ip}`;
      const [rateCheck] = await kv([['get', rateKey]]);
      if (rateCheck?.result) return res.status(429).json({ error: 'one submission per hour please' });

      const newId = slugify(t);

      // enforce unique ID (unique title slug)
      const existing = await kv([['lrange', 'arcade', '0', String(MAX_KEEP - 1)]]);
      const allIds = (existing[0]?.result || []).map(s => { try { return JSON.parse(s).id; } catch { return null; } }).filter(Boolean);
      if (allIds.includes(newId)) return res.status(409).json({ error: 'a game called "' + newId + '" already exists — pick a different title' });

      const entry = { id: newId, title: t, author: a, code: c, date: new Date().toISOString() };

      await kv([
        ['lpush', 'arcade', JSON.stringify(entry)],
        ['ltrim', 'arcade', '0', String(MAX_KEEP - 1)],
        ['set', rateKey, '1', 'ex', String(RATE_TTL)]
      ]);

      return res.status(200).json({ ok: true, id: newId });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[arcade]', err.message);
    res.status(500).json({ error: err.message });
  }
};
