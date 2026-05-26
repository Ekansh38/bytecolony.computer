// ── Comments API: per-post comments with one-level replies ─────────────────────
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

function kvKey(slug) { return 'comments:' + slug; }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Code');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const slug = url.searchParams.get('slug');

  try {
    // GET: return comments for a post
    if (req.method === 'GET') {
      // admin: list all comment keys
      if (url.searchParams.get('action') === 'all') {
        const master = process.env.ARCADE_MASTER_CODE;
        const code = req.headers['x-master-code'];
        if (!master || code !== master) return res.status(403).json({ error: 'unauthorized' });

        // scan for all comment keys
        const scanResult = await kv([['keys', 'comments:*']]);
        const keys = scanResult[0]?.result || [];
        if (!keys.length) return res.status(200).json([]);

        // fetch all lists
        const cmds = keys.map(k => ['lrange', k, '0', '199']);
        const results = await kv(cmds);
        const all = [];
        for (let i = 0; i < keys.length; i++) {
          const slug = keys[i].replace('comments:', '');
          const entries = (results[i]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
          entries.forEach(e => { e._slug = slug; all.push(e); });
        }
        all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return res.status(200).json(all);
      }

      if (!slug) return res.status(400).json({ error: 'slug required' });
      res.setHeader('Cache-Control', 'no-store');
      const key = kvKey(slug);
      const result = await kv([['lrange', key, '0', String(MAX_KEEP - 1)]]);
      const comments = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
      return res.status(200).json(comments);
    }

    // POST: add comment or delete (admin)
    if (req.method === 'POST') {
      const body = await getBody(req);

      // admin delete
      if (body.action === 'delete') {
        const master = process.env.ARCADE_MASTER_CODE;
        const code = req.headers['x-master-code'];
        if (!master || code !== master) return res.status(403).json({ error: 'unauthorized' });
        const { id, slug: delSlug } = body;
        if (!id || !delSlug) return res.status(400).json({ error: 'id and slug required' });
        const key = kvKey(delSlug);
        const result = await kv([['lrange', key, '0', '199']]);
        const comments = (result[0]?.result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        // remove the comment and any replies to it
        const filtered = comments.filter(c => c.id !== id && c.replyTo !== id);
        if (filtered.length === comments.length) return res.status(404).json({ error: 'not found' });
        const cmds = [['del', key]];
        if (filtered.length) cmds.push(['rpush', key, ...filtered.map(c => JSON.stringify(c))]);
        await kv(cmds);
        return res.status(200).json({ ok: true });
      }

      // add comment
      if (!slug) return res.status(400).json({ error: 'slug required' });
      const { name, message, hp, replyTo } = body;

      // honeypot
      if (hp) return res.status(200).json({ ok: true });

      const n = (name || '').trim().slice(0, MAX_NAME) || 'anonymous';
      const m = (message || '').trim().slice(0, MAX_MSG);
      if (!m) return res.status(400).json({ error: 'message is required' });

      const comment = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: n,
        message: m,
        date: new Date().toISOString(),
        ...(replyTo ? { replyTo } : {})
      };

      const key = kvKey(slug);
      await kv([
        ['rpush', key, JSON.stringify(comment)],
        ['ltrim', key, '0', String(MAX_KEEP - 1)]
      ]);

      return res.status(201).json(comment);
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[comments]', err.message);
    res.status(500).json({ error: err.message });
  }
};
