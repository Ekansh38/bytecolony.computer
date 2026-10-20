// ── Analytics beacon + stats readback ─────────────────────────────────────────
// Writes: POST /api/beacon   { event: "view"|"depth", path, ref?, tag?, depth? }
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
//   an:tag:<path>                    → hash { <?ref= tag> → count }
//   an:tags                          → hash { <?ref= tag> → count } site-wide
//   an:hll:<YYYY-MM-DD>              → HyperLogLog of daily visitor ids
//   an:hll-path:<YYYY-MM-DD>:<path>  → HyperLogLog, per path
//   an:geo / an:geo-path:<path>      → hash { country → count }
//   an:dev / an:dev-path:<path>      → hash { mobile|tablet|desktop → n }
//   an:hour                          → hash { 0..23 → count }
//   an:time:<path>                   → hash { engaged-time bucket → n }
//   an:act:<name> / an:act-path:..   → hash { label → count }

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

// Anonymous per-day visitor id.
//
// We deliberately never store the IP. Instead it is hashed together with
// the user agent and a salt that CHANGES EVERY DAY, so:
//   - the value cannot be reversed back to an IP
//   - the same person gets a different id tomorrow, so there is no
//     cross-day profile of an individual, only a daily headcount
// This keeps the store free of personal data (no consent banner needed)
// while still answering "how many different people", not just "how many
// page loads". The salt is derived from an existing secret, so there is
// no new env var to configure.
function visitorId(req, date) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.headers['x-real-ip'] || '';
  if (!ip) return '';
  const ua = req.headers['user-agent'] || '';
  const secret = process.env.ARCADE_MASTER_CODE || 'bytecolony';
  return crypto.createHash('sha256')
    .update(`${secret}:${date}:${ip}:${ua}`)
    .digest('hex')
    .slice(0, 16);
}

// Coarse device class from the user agent. Three buckets is all that is
// useful; browser/OS minutiae add noise without changing any decision.
function deviceType(ua) {
  ua = (ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod|phone/.test(ua)) return 'mobile';
  return 'desktop';
}

// Vercel resolves the country at the edge, so we get geography without
// ever handling the IP ourselves.
function country(req) {
  const c = (req.headers['x-vercel-ip-country'] || '').toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : '';
}

// Engaged-time buckets. A distribution is far more honest than a mean,
// which a handful of forgotten open tabs would wreck.
function timeBucket(s) {
  s = Number(s);
  if (!Number.isFinite(s) || s < 0) return '';
  if (s < 10)   return '0-10s';
  if (s < 30)   return '10-30s';
  if (s < 60)   return '30-60s';
  if (s < 180)  return '1-3m';
  if (s < 600)  return '3-10m';
  if (s < 1800) return '10-30m';
  return '30m+';
}

// Event and label names from the client are untrusted; keep them to a
// known charset and length so they cannot bloat a hash.
function cleanName(s, max) {
  if (!s || typeof s !== 'string') return '';
  return s.toLowerCase().replace(/[^a-z0-9_.\/-]/g, '').slice(0, max || 48);
}

// Campaign tag from a ?ref= link. Restricted charset and length so a
// crafted URL can't create unbounded hash fields.
function cleanTag(s) {
  if (!s || typeof s !== 'string') return '';
  return s.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
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

async function handleWrite(req, body) {
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
    const vid = visitorId(req, t);
    if (vid) {
      cmds.push(['pfadd',  `an:hll:${t}`, vid]);
      cmds.push(['pfadd',  `an:hll-path:${t}:${path}`, vid]);
      cmds.push(['expire', `an:hll:${t}`, String(60 * 60 * 24 * 400)]);
      cmds.push(['expire', `an:hll-path:${t}:${path}`, String(60 * 60 * 24 * 400)]);
    }

    const cc = country(req);
    if (cc) {
      cmds.push(['hincrby', `an:geo`, cc, '1']);
      cmds.push(['hincrby', `an:geo-path:${path}`, cc, '1']);
    }

    const dev = deviceType(req.headers['user-agent']);
    cmds.push(['hincrby', `an:dev`, dev, '1']);
    cmds.push(['hincrby', `an:dev-path:${path}`, dev, '1']);

    // local hour of the reader, so "when do people read this" is in
    // their time, not the server's
    const hr = Number.isFinite(Number(body.hour)) ? Math.max(0, Math.min(23, Math.floor(Number(body.hour)))) : null;
    if (hr !== null) cmds.push(['hincrby', `an:hour`, String(hr), '1']);
    const tag = cleanTag(body.tag || '');
    if (tag) {
      // campaign tags live in their own hash so they can't be confused
      // with browser referrers, and are counted site-wide too
      cmds.push(['hincrby', `an:tag:${path}`, tag, '1']);
      cmds.push(['hincrby', `an:tags`, tag, '1']);
    } else {
      const ro = refOrigin(body.ref || '');
      if (ro) cmds.push(['hincrby', `an:ref:${path}`, ro, '1']);
    }
  } else if (body.event === 'depth') {
    const bucket = depthBucket(body.depth);
    cmds.push(['hincrby', `an:depth:${path}`, bucket, '1']);
    if (Number(body.depth) >= 80) {
      cmds.push(['hincrby', `an:day:${t}`,              'reads', '1']);
      cmds.push(['hincrby', `an:path:${path}`,          'reads', '1']);
      cmds.push(['hincrby', `an:day-path:${t}:${path}`, 'reads', '1']);
    }
  } else if (body.event === 'time') {
    // engaged seconds: total + session count gives the mean, the bucket
    // hash gives the shape
    const secs = Math.max(0, Math.min(7200, Math.round(Number(body.secs) || 0)));
    if (secs > 0) {
      cmds.push(['hincrby', `an:path:${path}`, 'secs', String(secs)]);
      cmds.push(['hincrby', `an:path:${path}`, 'sessions', '1']);
      cmds.push(['hincrby', `an:day:${t}`,     'secs', String(secs)]);
      cmds.push(['hincrby', `an:day:${t}`,     'sessions', '1']);
      const tb = timeBucket(secs);
      if (tb) cmds.push(['hincrby', `an:time:${path}`, tb, '1']);
    }
  } else if (body.event === 'action') {
    // downloads, diagram opens, outbound clicks
    const name  = cleanName(body.name, 24);
    const label = cleanName(body.label, 64) || '(none)';
    if (!name) return { ok: false, error: 'bad action' };
    cmds.push(['hincrby', `an:act:${name}`, label, '1']);
    cmds.push(['hincrby', `an:act-path:${path}:${name}`, label, '1']);
    cmds.push(['hincrby', `an:day:${t}`, `act:${name}`, '1']);
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

  const dayHlls = days.map(d => `an:hll:${d}`);

  const cmds = [];
  days.forEach(d => cmds.push(['hgetall', `an:day:${d}`]));          // 0 .. 29
  days.forEach(d => cmds.push(['pfcount', `an:hll:${d}`]));          // daily uniques
  cmds.push(['pfcount', ...dayHlls]);                                 // 30d union
  cmds.push(['hgetall', 'an:geo']);
  cmds.push(['hgetall', 'an:dev']);
  cmds.push(['hgetall', 'an:hour']);
  cmds.push(['hgetall', 'an:act:format']);
  const FIXED = days.length * 2 + 5;
  paths.forEach(p => cmds.push(['hgetall', `an:path:${p}`]));
  paths.forEach(p => cmds.push(['pfcount', ...days.map(d => `an:hll-path:${d}:${p}`)]));
  const results = cmds.length ? await kv(cmds) : [];

  const num = i => Number(results[i]?.result || 0);

  const timeseries = days.map((d, i) => {
    const h = toObj(results[i]?.result);
    return {
      day: d,
      views: Number(h.views || 0),
      reads: Number(h.reads || 0),
      visitors: num(days.length + i),
    };
  });

  const visitors30 = num(days.length * 2);
  const geo   = toObj(results[days.length * 2 + 1]?.result);
  const dev   = toObj(results[days.length * 2 + 2]?.result);
  const hour  = toObj(results[days.length * 2 + 3]?.result);
  const fmts  = toObj(results[days.length * 2 + 4]?.result);

  const articles = paths.map((p, i) => {
    const h = toObj(results[FIXED + i]?.result);
    const secs = Number(h.secs || 0), sess = Number(h.sessions || 0);
    return {
      path: p,
      views: Number(h.views || 0),
      reads: Number(h.reads || 0),
      visitors: num(FIXED + paths.length + i),
      avgSecs: sess ? Math.round(secs / sess) : 0,
      first: h.first || null,
      last:  h.last  || null,
    };
  }).sort((a, b) => b.views - a.views);

  const totalViews = timeseries.reduce((s, x) => s + x.views, 0);
  const totalReads = timeseries.reduce((s, x) => s + x.reads, 0);
  const allTimeViews = articles.reduce((s, x) => s + x.views, 0);
  const allTimeReads = articles.reduce((s, x) => s + x.reads, 0);

  const sortHash = h => Object.keys(h)
    .map(k => ({ key: k, count: Number(h[k]) }))
    .sort((a, b) => b.count - a.count);

  return {
    timeseries,        // last 30 days
    articles,          // sorted by all-time views
    totals: {
      views_30d: totalViews,
      reads_30d: totalReads,
      views_all: allTimeViews,
      reads_all: allTimeReads,
      visitors_30d: visitors30,
    },
    geo: sortHash(geo).slice(0, 30),
    devices: sortHash(dev),
    hours: Array.from({ length: 24 }, (_, h) => Number(hour[String(h)] || 0)),
    formats: sortHash(fmts).slice(0, 20),
  };
}

async function handlePath(pathParam) {
  const p = cleanPath(pathParam);
  if (!p) return { error: 'bad path' };
  const days = lastNDays(30);
  const allDays = lastNDays(400);
  const cmds = [
    ['hgetall', `an:path:${p}`],
    ['hgetall', `an:depth:${p}`],
    ['hgetall', `an:ref:${p}`],
    ['hgetall', `an:tag:${p}`],
    ['hgetall', `an:geo-path:${p}`],
    ['hgetall', `an:dev-path:${p}`],
    ['hgetall', `an:time:${p}`],
    ['hgetall', `an:act-path:${p}:diagram`],
    ['hgetall', `an:act-path:${p}:download`],
    ['hgetall', `an:act-path:${p}:format`],
    ['hgetall', `an:act-path:${p}:outbound`],
    ['pfcount', ...days.map(d => `an:hll-path:${d}:${p}`)],
    ['pfcount', ...allDays.map(d => `an:hll-path:${d}:${p}`)],
  ];
  const HEAD = cmds.length;
  days.forEach(d => cmds.push(['hgetall', `an:day-path:${d}:${p}`]));
  days.forEach(d => cmds.push(['pfcount', `an:hll-path:${d}:${p}`]));
  const results = await kv(cmds);

  const total = toObj(results[0]?.result);
  const depth = toObj(results[1]?.result);
  const refs  = toObj(results[2]?.result);
  const tags  = toObj(results[3]?.result);
  const geo   = toObj(results[4]?.result);
  const dev   = toObj(results[5]?.result);
  const times = toObj(results[6]?.result);
  const diag  = toObj(results[7]?.result);
  const dls   = toObj(results[8]?.result);
  const fmts  = toObj(results[9]?.result);
  const outb  = toObj(results[10]?.result);
  const visitors30  = Number(results[11]?.result || 0);
  const visitorsAll = Number(results[12]?.result || 0);

  const timeseries = days.map((d, i) => {
    const h = toObj(results[HEAD + i]?.result);
    return {
      day: d,
      views: Number(h.views || 0),
      reads: Number(h.reads || 0),
      visitors: Number(results[HEAD + days.length + i]?.result || 0),
    };
  });

  const referrers = Object.keys(refs)
    .map(k => ({ origin: k, count: Number(refs[k]) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const tagList = Object.keys(tags)
    .map(k => ({ tag: k, count: Number(tags[k]) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const sortHash = h => Object.keys(h)
    .map(k => ({ key: k, count: Number(h[k]) }))
    .sort((a, b) => b.count - a.count);

  const secs = Number(total.secs || 0), sess = Number(total.sessions || 0);

  return {
    path: p,
    totals: {
      views: Number(total.views || 0),
      reads: Number(total.reads || 0),
      visitors: visitors30,
      visitorsAll,
      avgSecs: sess ? Math.round(secs / sess) : 0,
      totalSecs: secs,
      first: total.first || null,
      last:  total.last  || null,
    },
    geo: sortHash(geo).slice(0, 30),
    devices: sortHash(dev),
    times: sortHash(times),
    diagrams: sortHash(diag).slice(0, 40),
    downloads: sortHash(dls).slice(0, 20),
    formats: sortHash(fmts).slice(0, 20),
    outbound: sortHash(outb).slice(0, 20),
    depth: {
      '0':   Number(depth['0']   || 0),
      '25':  Number(depth['25']  || 0),
      '50':  Number(depth['50']  || 0),
      '75':  Number(depth['75']  || 0),
      '100': Number(depth['100'] || 0),
    },
    timeseries,
    referrers,
    tags: tagList,
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
      ['del', `an:tag:${p}`],
      ['del', `an:geo-path:${p}`],
      ['del', `an:dev-path:${p}`],
      ['del', `an:time:${p}`],
      ['del', `an:act-path:${p}:diagram`],
      ['del', `an:act-path:${p}:download`],
      ['del', `an:act-path:${p}:format`],
      ['del', `an:act-path:${p}:outbound`],
      ['srem', `an:paths`, p],
    ];
    days.forEach(d => cmds.push(['del', `an:day-path:${d}:${p}`]));
    days.forEach(d => cmds.push(['del', `an:hll-path:${d}:${p}`]));
    await kv(cmds);
    return { ok: true, cleared: p };
  }
  if (body.all === true) {
    const pathsRes = await kv([['smembers', 'an:paths']]);
    const paths = (pathsRes[0]?.result || []);
    const days = lastNDays(400);
    const cmds = [
      ['del', 'an:paths'], ['del', 'an:tags'],
      ['del', 'an:geo'], ['del', 'an:dev'], ['del', 'an:hour'],
      ['del', 'an:act:diagram'], ['del', 'an:act:download'], ['del', 'an:act:format'], ['del', 'an:act:outbound'],
    ];
    paths.forEach(p => {
      cmds.push(['del', `an:path:${p}`]);
      cmds.push(['del', `an:depth:${p}`]);
      cmds.push(['del', `an:ref:${p}`]);
      cmds.push(['del', `an:tag:${p}`]);
      cmds.push(['del', `an:geo-path:${p}`]);
      cmds.push(['del', `an:dev-path:${p}`]);
      cmds.push(['del', `an:time:${p}`]);
      cmds.push(['del', `an:act-path:${p}:diagram`]);
      cmds.push(['del', `an:act-path:${p}:download`]);
      cmds.push(['del', `an:act-path:${p}:format`]);
      cmds.push(['del', `an:act-path:${p}:outbound`]);
      days.forEach(d => cmds.push(['del', `an:day-path:${d}:${p}`]));
      days.forEach(d => cmds.push(['del', `an:hll-path:${d}:${p}`]));
    });
    days.forEach(d => { cmds.push(['del', `an:day:${d}`]); cmds.push(['del', `an:hll:${d}`]); });
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
      const out = await handleWrite(req, body);
      return res.status(out.ok ? 200 : 400).json(out);
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[beacon]', err);
    res.status(500).json({ error: 'server error' });
  }
};
