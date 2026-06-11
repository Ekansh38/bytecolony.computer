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

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'game';
}
function hashCode(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function checkAuth(submitted, game) {
  const master = process.env.ARCADE_MASTER_CODE;
  if (master && submitted && safeEqual(submitted, master)) return true;
  return game.codeHash && safeEqual(hashCode(submitted), game.codeHash);
}

const MAX_TITLE = 50, MAX_AUTHOR = 50, MAX_DESC = 200, MAX_CODE = 25000;
const MAX_KEEP = 50;

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
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const reqUrl = new URL(req.url, 'https://placeholder');
  const id = reqUrl.searchParams.get('id');

  try {
    // ── GET list ──────────────────────────────────────────────────────────────
    if (req.method === 'GET' && !id) {
      res.setHeader('Cache-Control', 'no-store');
      const all = await fetchAll();
      return res.status(200).json(all.map(g => ({ id: g.id, title: g.title, author: g.author, desc: g.desc || '', date: g.date, ...(g.locked ? { locked: true } : {}), ...(g.closedSource ? { closedSource: true } : {}) })));
    }

    // ── GET single game by id ─────────────────────────────────────────────────
    if (req.method === 'GET' && id) {
      res.setHeader('Cache-Control', 'no-store');
      const all = await fetchAll();
      const game = all.find(g => g.id === id);
      if (!game) return res.status(404).json({ error: 'game not found' });
      if (game.locked) {
        const code = reqUrl.searchParams.get('code') || '';
        if (!code || !checkAuth(code, game)) return res.status(200).json({ locked: true, id: game.id, title: game.title });
      }
      const { codeHash, ...safe } = game; // don't expose hash
      return res.status(200).json(safe);
    }

    // ── POST: submit a game ───────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { title, author, desc, code, editCode, lbMode, locked, closedSource, hp } = req.body || {};
      if (hp) return res.status(200).json({ ok: true });

      if (!(await rateLimit(req, 'games', 5))) {
        return res.status(429).json({ error: 'whoa, slow down a bit — try again in a minute' });
      }

      const t  = (title    || '').trim().slice(0, MAX_TITLE);
      const a  = (author   || '').trim().slice(0, MAX_AUTHOR);
      const d  = (desc     || '').trim().slice(0, MAX_DESC);
      const c  = (code     || '').trim().slice(0, MAX_CODE);
      const ec = (editCode || '').trim();
      const lb = lbMode === 'asc' ? 'asc' : 'desc';
      if (!t || !a || !c) return res.status(400).json({ error: 'title, author, and code are all required' });
      if (!ec || ec.length < 4) return res.status(400).json({ error: 'edit code must be at least 4 characters' });

      const newId = slugify(t);
      const all = await fetchAll();
      if (all.some(g => g.id === newId))
        return res.status(409).json({ error: `a game called "${newId}" already exists, pick a different title` });

      const entry = { id: newId, title: t, author: a, desc: d, code: c, lbMode: lb, locked: !!locked, closedSource: !!closedSource, date: new Date().toISOString(), codeHash: hashCode(ec) };

      await kv([
        ['lpush', 'arcade', JSON.stringify(entry)],
        ['ltrim', 'arcade', '0', String(MAX_KEEP - 1)]
      ]);

      return res.status(200).json({ ok: true, id: newId });
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
      const { code, newCode, newTitle, newDesc, newAuthor, lbMode, locked, closedSource } = await getBody(req);
      if (!code) return res.status(400).json({ error: 'edit code required' });
      if (!newCode && !newTitle && newDesc === undefined && !newAuthor && !lbMode && locked === undefined && closedSource === undefined) return res.status(400).json({ error: 'nothing to update' });

      const all = await fetchAll();
      const game = all.find(g => g.id === id);
      if (!game) return res.status(404).json({ error: 'game not found' });
      if (!checkAuth(code, game)) return res.status(403).json({ error: 'invalid edit code' });

      const patch = {};
      if (newCode)              patch.code  = newCode.trim().slice(0, MAX_CODE);
      if (newTitle) {
        const trimTitle = newTitle.trim().slice(0, MAX_TITLE);
        patch.title = trimTitle;
        const newId = slugify(trimTitle);
        if (newId && newId !== id) {
          // check for conflict (excluding current game)
          if (all.some(g => g.id === newId)) {
            return res.status(409).json({ error: `a game with id "${newId}" already exists` });
          }
          patch.id = newId;
        }
      }
      if (newDesc !== undefined) patch.desc  = newDesc.trim().slice(0, MAX_DESC);
      if (newAuthor)            patch.author = newAuthor.trim().slice(0, MAX_AUTHOR);
      if (lbMode === 'asc' || lbMode === 'desc') patch.lbMode = lbMode;
      if (locked !== undefined) patch.locked = !!locked;
      if (closedSource !== undefined) patch.closedSource = !!closedSource;

      const newIdVal = patch.id;
      const updated = all.map(g => g.id === id ? { ...g, ...patch } : g);
      await rebuildList(updated);
      return res.status(200).json({ ok: true, newId: newIdVal || id });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[arcade]', err);
    res.status(500).json({ error: 'server error' });
  }
};
