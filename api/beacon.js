// ── Analytics beacon + stats readback ─────────────────────────────────────────
// Writes: POST /api/beacon   { event: "view"|"depth", path, ref?, depth? }
// Reads:  GET  /api/beacon?action=overview   (auth)
//         GET  /api/beacon?action=path&p=<path>  (auth)
//
// KV keys:
//   an:day:<YYYY-MM-DD>              → hash { views, reads }
//   an:path:<path>                   → hash { views, reads, first, last }
//   an:day-path:<YYYY-MM-DD>:<path>  → hash { views, reads }
//   an:paths                         → set  of all seen paths
//   an:depth:<path>                  → hash { 0, 25, 50, 75, 100 }
//   an:ref:<path>                    → hash { <origin> → count }

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

function auth(req) {
  const master = process.env.ARCADE_MASTER_CODE;
  const code = req.headers['x-master-code'];
  return !!(master && code && safeEqual(code, master));
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin === 'https://bytecolony.computer'
    || origin === 'https://www.bytecolony.computer'
    || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Normalize the path we store: strip trailing index.html, collapse slashes,
// cap length so a rogue query string can't blow up a key.
function cleanPath(p) {
  if (!p || typeof p !== 'string') return '';
  p = p.split('?')[0].split('#')[0];
  p = p.replace(/\/index\.html$/, '/').replace(/\/{2,}/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 200) p = p.slice(0, 200);
  return p;
}

// Extract the origin (scheme + host) of a referrer URL, or '' if invalid.
function refOrigin(ref) {
  try {
    const u = new URL(ref);
    return u.origin;
  } catch { return ''; }
}

// Depth bucket labels: 0, 25, 50, 75, 100 — one bucket wide each.
function depthBucket(d) {
  d = Number(d);
  if (!Number.isFinite(d) || d < 0) return '0';
  if (d >= 100) return '100';
  if (d >= 75)  return '75';
  if (d >= 50)  return '50';
  if (d >= 25)  return '25';
  return '0';
}

// Reject beacons that are clearly bots / previews / our own dev
function isDroppedBeacon(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (!ua) return true;
  if (/(bot|crawler|spider|preview|headlesschrome|lighthouse|curl|wget|python-requests|node-fetch)/.test(ua)) return true;
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
  return false;
}

async function handleWrite(body) {
  const path = cleanPath(body.path);
  if (!path) return { ok: false, error: 'bad path' };
  const t = today();
  const nowIso = new Date().toISOString();

  const cmds = [];

  if (body.event === 'view') {
    cmds.push(['hincrby', `an:day:${t}`,             'views', '1']);
    cmds.push(['hincrby', `an:path:${path}`,         'views', '1']);
    cmds.push(['hincrby', `an:day-path:${t}:${path}`, 'views', '1']);
    cmds.push(['hsetnx',  `an:path:${path}`,         'first', nowIso]);
    cmds.push(['hset',    `an:path:${path}`,         'last',  nowIso]);
    cmds.push(['sadd',    `an:paths`,                path]);
    // TTL guardrails: per-day keys expire after 400 days so old data doesn't pile up
    cmds.push(['expire',  `an:day:${t}`,             String(60 * 60 * 24 * 400)]);
    cmds.push(['expire',  `an:day-path:${t}:${path}`, String(60 * 60 * 24 * 400)]);
    const ro = refOrigin(body.ref || '');
    if (ro) cmds.push(['hincrby', `an:ref:${path}`, ro, '1']);
  } else if (body.event === 'depth') {
    const bucket = depthBucket(body.depth);
    cmds.push(['hincrby', `an:depth:${path}`, bucket, '1']);
    if (Number(body.depth) >= 80) {
      cmds.push(['hincrby', `an:day:${t}`,              'reads', '1']);
      cmds.push(['hincrby', `an:path:${path}`,          'reads', '1']);
      cmds.push(['hincrby', `an:day-path:${t}:${path}`, 'reads', '1']);
    }
  } else {
    return { ok: false, error: 'unknown event' };
  }

  await kv(cmds);
  return { ok: true };
}

function lastNDays(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const key = d.toISOString().slice(0, 10);
    out.push(key);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

function toObj(hgetallResult) {
  // Upstash returns hgetall as { field: value } directly (object form).
  if (!hgetallResult) return {};
  if (Array.isArray(hgetallResult)) {
    const o = {};
    for (let i = 0; i < hgetallResult.length; i += 2) o[hgetallResult[i]] = hgetallResult[i + 1];
    return o;
  }
  return hgetallResult;
}

async function handleOverview() {
  const days = lastNDays(30);
  const pathsRes = await kv([['smembers', 'an:paths']]);
  const paths = (pathsRes[0]?.result || []);

  const cmds = [];
  days.forEach(d => cmds.push(['hgetall', `an:day:${d}`]));
  paths.forEach(p => cmds.push(['hgetall', `an:path:${p}`]));
  const results = cmds.length ? await kv(cmds) : [];

  const timeseries = days.map((d, i) => {
    const h = toObj(results[i]?.result);
    return { day: d, views: Number(h.views || 0), reads: Number(h.reads || 0) };
  });

  const articles = paths.map((p, i) => {
    const h = toObj(results[days.length + i]?.result);
    return {
      path: p,
      views: Number(h.views || 0),
      reads: Number(h.reads || 0),
      first: h.first || null,
      last:  h.last  || null,
    };
  }).sort((a, b) => b.views - a.views);

  const totalViews = timeseries.reduce((s, x) => s + x.views, 0);
  const totalReads = timeseries.reduce((s, x) => s + x.reads, 0);
  const allTimeViews = articles.reduce((s, x) => s + x.views, 0);
  const allTimeReads = articles.reduce((s, x) => s + x.reads, 0);

  return {
    timeseries,        // last 30 days
    articles,          // sorted by all-time views
    totals: {
      views_30d: totalViews,
      reads_30d: totalReads,
      views_all: allTimeViews,
      reads_all: allTimeReads,
    },
  };
}

async function handlePath(pathParam) {
  const p = cleanPath(pathParam);
  if (!p) return { error: 'bad path' };
  const days = lastNDays(30);
  const cmds = [
    ['hgetall', `an:path:${p}`],
    ['hgetall', `an:depth:${p}`],
    ['hgetall', `an:ref:${p}`],
  ];
  days.forEach(d => cmds.push(['hgetall', `an:day-path:${d}:${p}`]));
  const results = await kv(cmds);

  const total = toObj(results[0]?.result);
  const depth = toObj(results[1]?.result);
  const refs  = toObj(results[2]?.result);

  const timeseries = days.map((d, i) => {
    const h = toObj(results[3 + i]?.result);
    return { day: d, views: Number(h.views || 0), reads: Number(h.reads || 0) };
  });

  const referrers = Object.keys(refs)
    .map(k => ({ origin: k, count: Number(refs[k]) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    path: p,
    totals: {
      views: Number(total.views || 0),
      reads: Number(total.reads || 0),
      first: total.first || null,
      last:  total.last  || null,
    },
    depth: {
      '0':   Number(depth['0']   || 0),
      '25':  Number(depth['25']  || 0),
      '50':  Number(depth['50']  || 0),
      '75':  Number(depth['75']  || 0),
      '100': Number(depth['100'] || 0),
    },
    timeseries,
    referrers,
  };
}

async function handleReset(body) {
  // Wipe a single path or the whole store. Destructive; auth-only.
  if (body.path) {
    const p = cleanPath(body.path);
    const days = lastNDays(400);
    const cmds = [
      ['del', `an:path:${p}`],
      ['del', `an:depth:${p}`],
      ['del', `an:ref:${p}`],
      ['srem', `an:paths`, p],
    ];
    days.forEach(d => cmds.push(['del', `an:day-path:${d}:${p}`]));
    await kv(cmds);
    return { ok: true, cleared: p };
  }
  if (body.all === true) {
    const pathsRes = await kv([['smembers', 'an:paths']]);
    const paths = (pathsRes[0]?.result || []);
    const days = lastNDays(400);
    const cmds = [['del', 'an:paths']];
    paths.forEach(p => {
      cmds.push(['del', `an:path:${p}`]);
      cmds.push(['del', `an:depth:${p}`]);
      cmds.push(['del', `an:ref:${p}`]);
      days.forEach(d => cmds.push(['del', `an:day-path:${d}:${p}`]));
    });
    days.forEach(d => cmds.push(['del', `an:day:${d}`]));
    // Upstash pipeline has a soft cap; batch in chunks of 900 to stay well under.
    for (let i = 0; i < cmds.length; i += 900) await kv(cmds.slice(i, i + 900));
    return { ok: true, cleared: 'all', paths: paths.length };
  }
  return { ok: false, error: 'nothing to reset' };
}

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Code');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');

    if (req.method === 'GET') {
      if (!auth(req)) return res.status(403).json({ error: 'unauthorized' });
      res.setHeader('Cache-Control', 'no-store');
      if (action === 'overview') return res.status(200).json(await handleOverview());
      if (action === 'path') {
        const p = url.searchParams.get('p') || '';
        return res.status(200).json(await handlePath(p));
      }
      return res.status(400).json({ error: 'action required' });
    }

    if (req.method === 'POST') {
      const body = await getBody(req);
      if (body.action === 'reset') {
        if (!auth(req)) return res.status(403).json({ error: 'unauthorized' });
        return res.status(200).json(await handleReset(body));
      }
      // Write path: no auth (this is a public beacon), but drop bots/previews.
      if (isDroppedBeacon(req)) return res.status(204).end();
      const out = await handleWrite(body);
      return res.status(out.ok ? 200 : 400).json(out);
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[beacon]', err);
    res.status(500).json({ error: 'server error' });
  }
};
