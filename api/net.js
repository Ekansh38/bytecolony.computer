const crypto = require('crypto');

async function kv(commands) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV env vars missing');
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`KV ${res.status}: ${t}`); }
  return res.json();
}

function hashCode(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

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

async function checkAuth(code, gameId) {
  const master = process.env.ARCADE_MASTER_CODE;
  if (master && code && safeEqual(code, master)) return true;
  const result = await kv([['lrange', 'arcade', '0', '49']]);
  const games = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  const game = games.find(g => g.id === gameId);
  if (!game || !game.codeHash) return false;
  return hashCode(code) === game.codeHash;
}

const MAX_KEY = 50, MAX_VAL = 500, MAX_NAME = 50, MAX_N = 100;

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const reqUrl = new URL(req.url, 'https://placeholder');
    const game = (reqUrl.searchParams.get('game') || '').slice(0, 50);
    if (!game) return res.status(400).json({ error: 'game required' });

    // ── GET ──────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const op = reqUrl.searchParams.get('op');

      if (op === 'get') {
        const key = (reqUrl.searchParams.get('key') || '').slice(0, MAX_KEY);
        if (!key) return res.status(400).json({ error: 'key required' });
        res.setHeader('Cache-Control', 'no-store');
        const result = await kv([['get', `net:${game}:kv:${key}`]]);
        return res.status(200).json({ value: result[0]?.result ?? null });
      }

      if (op === 'top' || op === 'bottom') {
        const n = Math.min(Math.max(1, parseInt(reqUrl.searchParams.get('n') || '10', 10)), MAX_N);
        res.setHeader('Cache-Control', 'no-store');
        const cmd = op === 'bottom' ? 'zrange' : 'zrevrange';
        const result = await kv([[cmd, `net:${game}:lb`, '0', String(n - 1), 'WITHSCORES']]);
        const raw = result[0]?.result || [];
        // resolve display names from lowercase keys
        const lowerNames = [];
        for (let i = 0; i < raw.length; i += 2) lowerNames.push(raw[i]);
        let nameMap = {};
        if (lowerNames.length > 0) {
          const lookups = lowerNames.map(ln => ['get', `net:${game}:name:${ln}`]);
          const nameResults = await kv(lookups);
          for (let i = 0; i < lowerNames.length; i++)
            nameMap[lowerNames[i]] = nameResults[i]?.result || lowerNames[i];
        }
        const entries = [];
        for (let i = 0; i < raw.length; i += 2)
          entries.push({ name: nameMap[raw[i]] || raw[i], score: parseFloat(raw[i + 1]) });
        return res.status(200).json({ entries });
      }

      return res.status(400).json({ error: 'unknown op' });
    }

    // ── POST ─────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const op = body.op;

      if (op === 'set') {
        const key = String(body.key || '').trim().slice(0, MAX_KEY);
        const val = String(body.value ?? '').slice(0, MAX_VAL);
        if (!key) return res.status(400).json({ error: 'key required' });
        if (!(await rateLimit(req, 'net', 30))) {
          return res.status(429).json({ error: 'whoa, slow down a bit — try again in a minute' });
        }
        // 30-day TTL — games are responsible for refreshing persistent data
        await kv([['set', `net:${game}:kv:${key}`, val, 'EX', String(60 * 60 * 24 * 30)]]);
        return res.status(200).json({ ok: true });
      }

      if (op === 'rank') {
        const name  = String(body.name  || '').trim().slice(0, MAX_NAME);
        const score = Number(body.score);
        if (!name)            return res.status(400).json({ error: 'name required' });
        if (!isFinite(score)) return res.status(400).json({ error: 'score must be a number' });
        if (!(await rateLimit(req, 'net', 30))) {
          return res.status(429).json({ error: 'whoa, slow down a bit — try again in a minute' });
        }
        const lower = name.toLowerCase();
        // preserve original casing: only store if no prior entry
        const nameKey = `net:${game}:name:${lower}`;
        const existing = await kv([['get', nameKey]]);
        const displayName = existing[0]?.result || name;
        // look up game's lbMode to decide GT (higher wins) vs LT (lower wins)
        const gamesResult = await kv([['lrange', 'arcade', '0', '49']]);
        const games = (gamesResult[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        const gMeta = games.find(g => g.id === game);
        const flag = (gMeta && gMeta.lbMode === 'asc') ? 'LT' : 'GT';
        const cmds = [
          ['zadd', `net:${game}:lb`, flag, String(score), lower],
          ['expire', `net:${game}:lb`, String(60 * 60 * 24 * 90)],
        ];
        // store name casing only on first use
        if (!existing[0]?.result) {
          cmds.push(['set', nameKey, name, 'EX', String(60 * 60 * 24 * 90)]);
        }
        await kv(cmds);
        return res.status(200).json({ ok: true });
      }

      if (op === 'clear') {
        const code = String(body.code || '');
        if (!code) return res.status(400).json({ error: 'edit code required' });
        const authed = await checkAuth(code, game);
        if (!authed) return res.status(403).json({ error: 'invalid edit code' });
        // find all kv keys for this game and delete them + leaderboard
        const scanResult = await kv([['keys', `net:${game}:*`]]);
        const keys = scanResult[0]?.result || [];
        if (keys.length > 0) {
          await kv(keys.map(k => ['del', k]));
        }
        return res.status(200).json({ ok: true, deleted: keys.length });
      }

      return res.status(400).json({ error: 'unknown op' });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[net]', err);
    res.status(500).json({ error: 'server error' });
  }
};
