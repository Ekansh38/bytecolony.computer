const crypto = require('crypto');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin === 'https://bytecolony.computer'
    || origin === 'https://www.bytecolony.computer'
    || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

async function rateLimit(req, scope, max) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const key = `rl:${scope}:${ip}`;
  const r = await kv([['incr', key], ['expire', key, '60', 'NX']]);
  return (r[0]?.result || 0) <= max;
}

// ── Vercel KV via Upstash REST API ────────────────────────────────────────────
async function kv(commands) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
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
const MAX_MSG  = 500;
const MAX_KEEP = 200;

async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function fetchAll() {
  const result = await kv([['lrange', 'guestbook', '0', String(MAX_KEEP - 1)]]);
  return (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

async function rebuildList(entries) {
  const serialized = entries.map(e => JSON.stringify(e));
  const commands = [['del', 'guestbook']];
  if (serialized.length) commands.push(['rpush', 'guestbook', ...serialized]);
  await kv(commands);
}

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: return entries
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const entries = await fetchAll();
      // backfill id for legacy entries so they can be deleted
      let dirty = false;
      for (const e of entries) {
        if (!e.id) { e.id = 'legacy_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); dirty = true; }
      }
      if (dirty) await rebuildList(entries);
      return res.status(200).json(entries.filter(e => e.message).map(e => ({
        id: e.id, name: e.name || 'anonymous', context: e.context || '', message: e.message, date: e.date
      })));
    }

    // POST: add entry
    if (req.method === 'POST') {
      const body = await getBody(req);
      const { name, context, message, hp } = body;

      // honeypot: bots fill this hidden field
      if (hp) return res.status(200).json({ ok: true });

      if (!(await rateLimit(req, 'guestbook', 4))) {
        return res.status(429).json({ error: 'whoa, slow down a bit — try again in a minute' });
      }

      const n = (name || '').trim().slice(0, MAX_NAME) || 'anonymous';
      const c = (context || '').trim().slice(0, 100);
      const m = (message || '').trim().slice(0, MAX_MSG);
      if (!m) return res.status(400).json({ error: 'message is required' });

      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: n,
        ...(c ? { context: c } : {}),
        message: m,
        date: new Date().toISOString().split('T')[0]
      };

      await kv([
        ['lpush', 'guestbook', JSON.stringify(entry)],
        ['ltrim', 'guestbook', '0', String(MAX_KEEP - 1)]
      ]);

      return res.status(201).json(entry);
    }

    // DELETE: remove entry (master code only)
    if (req.method === 'DELETE') {
      const body = await getBody(req);
      const { id, code } = body;
      if (!id || !code) return res.status(400).json({ error: 'id and code required' });

      const master = process.env.ARCADE_MASTER_CODE;
      if (!master || !code || !safeEqual(code, master)) return res.status(403).json({ error: 'unauthorized' });

      const entries = await fetchAll();
      const filtered = entries.filter(e => e.id !== id);
      if (filtered.length === entries.length) return res.status(404).json({ error: 'entry not found' });

      await rebuildList(filtered);
      return res.status(200).json({ ok: true, deleted: 1 });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[guestbook]', err);
    res.status(500).json({ error: 'server error' });
  }
};
