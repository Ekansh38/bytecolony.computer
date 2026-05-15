const crypto = require('crypto');

// Vercel doesn't parse bodies for DELETE/PATCH — read manually as fallback
async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

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
function hashCode(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function genCode() {
  const h = crypto.randomBytes(5).toString('hex'); // 10 hex chars
  return h.slice(0, 5) + '-' + h.slice(5);         // e.g. a3f9b-2c81d
}
function checkAuth(submitted, game) {
  const master = process.env.ARCADE_MASTER_CODE;
  if (master && submitted === master) return true;
  return game.codeHash && hashCode(submitted) === game.codeHash;
}

const MAX_TITLE = 50, MAX_AUTHOR = 50, MAX_CODE = 8000;
const RATE_TTL = 3600, MAX_KEEP = 50;

async function fetchAll() {
  const result = await kv([['lrange', 'arcade', '0', String(MAX_KEEP - 1)]]);
  return (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

async function rebuildList(all) {
  const serialized = all.map(g => JSON.stringify(g));
  const commands = [['del', 'arcade']];
  if (serialized.length) commands.push(['rpush', 'arcade', ...serialized]);
  await kv(commands);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const reqUrl = new URL(req.url, 'https://placeholder');
  const id = reqUrl.searchParams.get('id');

  try {
    // ── GET list ──────────────────────────────────────────────────────────────
    if (req.method === 'GET' && !id) {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      const all = await fetchAll();
      return res.status(200).json(all.map(g => ({ id: g.id, title: g.title, author: g.author, date: g.date })));
    }

    // ── GET single game by id ─────────────────────────────────────────────────
    if (req.method === 'GET' && id) {
      res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
      const all = await fetchAll();
      const game = all.find(g => g.id === id);
      if (!game) return res.status(404).json({ error: 'game not found' });
      const { codeHash, ...safe } = game; // don't expose hash
      return res.status(200).json(safe);
    }

    // ── POST: submit a game ───────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { title, author, code, hp } = req.body || {};
      if (hp) return res.status(200).json({ ok: true });

      const t = (title  || '').trim().slice(0, MAX_TITLE);
      const a = (author || '').trim().slice(0, MAX_AUTHOR);
      const c = (code   || '').trim().slice(0, MAX_CODE);
      if (!t || !a || !c) return res.status(400).json({ error: 'title, author, and code are all required' });

      const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
      const rateKey = `arcade_rate:${ip}`;
      const [rateCheck] = await kv([['get', rateKey]]);
      if (rateCheck?.result) return res.status(429).json({ error: 'one submission per hour please' });

      const newId = slugify(t);
      const all = await fetchAll();
      if (all.some(g => g.id === newId))
        return res.status(409).json({ error: `a game called "${newId}" already exists — pick a different title` });

      const editCode = genCode();
      const entry = { id: newId, title: t, author: a, code: c, date: new Date().toISOString(), codeHash: hashCode(editCode) };

      await kv([
        ['lpush', 'arcade', JSON.stringify(entry)],
        ['ltrim', 'arcade', '0', String(MAX_KEEP - 1)],
        ['set', rateKey, '1', 'ex', String(RATE_TTL)]
      ]);

      return res.status(200).json({ ok: true, id: newId, editCode });
    }

    // ── DELETE: remove a game ─────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const { code } = await getBody(req);
      if (!code) return res.status(400).json({ error: 'edit code required' });

      const all = await fetchAll();
      const game = all.find(g => g.id === id);
      if (!game) return res.status(404).json({ error: 'game not found' });
      if (!checkAuth(code, game)) return res.status(403).json({ error: 'invalid edit code' });

      await rebuildList(all.filter(g => g.id !== id));
      return res.status(200).json({ ok: true });
    }

    // ── PATCH: update a game's code ───────────────────────────────────────────
    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const { code, newCode } = await getBody(req);
      if (!code) return res.status(400).json({ error: 'edit code required' });
      if (!newCode) return res.status(400).json({ error: 'newCode required' });

      const all = await fetchAll();
      const game = all.find(g => g.id === id);
      if (!game) return res.status(404).json({ error: 'game not found' });
      if (!checkAuth(code, game)) return res.status(403).json({ error: 'invalid edit code' });

      const updated = all.map(g => g.id === id ? { ...g, code: newCode.trim().slice(0, MAX_CODE) } : g);
      await rebuildList(updated);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[arcade]', err.message);
    res.status(500).json({ error: err.message });
  }
};
