// ── Admin API: guestbook + arcade + presets ───────────────────────────────────
async function kv(commands) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV env vars missing');
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error(`KV ${res.status}: ${await res.text()}`);
  return res.json();
}

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

function auth(req) {
  const master = process.env.ARCADE_MASTER_CODE;
  const code = req.headers['x-master-code'];
  return !!(master && code && safeEqual(code, master));
}

async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Code');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET /api/themes?action=verify — verify master code
    // GET /api/themes?action=guestbook — get guestbook entries
    // GET /api/themes?action=games — get arcade games
    // GET /api/themes?action=presets — get presets
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');

    if (req.method === 'GET') {
      if (action === 'verify') {
        if (!auth(req)) return res.status(403).json({ ok: false });
        return res.status(200).json({ ok: true });
      }
      if (action === 'guestbook') {
        if (!auth(req)) return res.status(403).json({ error: 'unauthorized' });
        const result = await kv([['lrange', 'guestbook', '0', '199']]);
        const entries = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        return res.status(200).json(entries);
      }
      if (action === 'games') {
        if (!auth(req)) return res.status(403).json({ error: 'unauthorized' });
        const result = await kv([['lrange', 'arcade', '0', '49']]);
        const games = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        return res.status(200).json(games);
      }
      if (action === 'presets') {
        // presets are public read
        res.setHeader('Cache-Control', 'no-store');
        const result = await kv([['get', 'presets']]);
        const presets = result[0]?.result ? JSON.parse(result[0].result) : null;
        return res.status(200).json({ presets });
      }
      return res.status(400).json({ error: 'action required' });
    }

    // All writes require auth
    if (!auth(req)) return res.status(403).json({ error: 'unauthorized' });
    const body = await getBody(req);

    if (req.method === 'POST') {
      // POST: save presets or delete guestbook/game entries
      if (body.action === 'save-presets') {
        const { presets } = body;
        if (!presets || typeof presets !== 'object') return res.status(400).json({ error: 'presets object required' });
        await kv([['set', 'presets', JSON.stringify(presets)]]);
        return res.status(200).json({ ok: true, count: Object.keys(presets).length });
      }
      if (body.action === 'delete-guestbook') {
        const { id } = body;
        if (!id) return res.status(400).json({ error: 'id required' });
        const result = await kv([['lrange', 'guestbook', '0', '199']]);
        const entries = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        const filtered = entries.filter(e => e.id !== id);
        if (filtered.length === entries.length) return res.status(404).json({ error: 'not found' });
        const serialized = filtered.map(e => JSON.stringify(e));
        const cmds = [['del', 'guestbook']];
        if (serialized.length) cmds.push(['rpush', 'guestbook', ...serialized]);
        await kv(cmds);
        return res.status(200).json({ ok: true });
      }
      if (body.action === 'delete-game') {
        const { id } = body;
        if (!id) return res.status(400).json({ error: 'id required' });
        const result = await kv([['lrange', 'arcade', '0', '49']]);
        const games = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        const filtered = games.filter(g => g.id !== id);
        if (filtered.length === games.length) return res.status(404).json({ error: 'not found' });
        const serialized = filtered.map(g => JSON.stringify(g));
        const cmds = [['del', 'arcade']];
        if (serialized.length) cmds.push(['rpush', 'arcade', ...serialized]);
        await kv(cmds);
        return res.status(200).json({ ok: true });
      }
      if (body.action === 'update-game') {
        const { id, updates } = body;
        if (!id || !updates) return res.status(400).json({ error: 'id and updates required' });
        const result = await kv([['lrange', 'arcade', '0', '49']]);
        const games = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        const idx = games.findIndex(g => g.id === id);
        if (idx < 0) return res.status(404).json({ error: 'not found' });
        Object.assign(games[idx], updates);
        const serialized = games.map(g => JSON.stringify(g));
        const cmds = [['del', 'arcade']];
        if (serialized.length) cmds.push(['rpush', 'arcade', ...serialized]);
        await kv(cmds);
        return res.status(200).json({ ok: true, game: games[idx] });
      }
      return res.status(400).json({ error: 'unknown action' });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[admin]', err);
    res.status(500).json({ error: 'server error' });
  }
};
