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

function auth(code) {
  const master = process.env.ARCADE_MASTER_CODE;
  return master && code === master;
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

// CSS variable names that define a theme
const THEME_VARS = [
  'bg','fg','muted','accent','border','shadow',
  'code-bg','code-fg','code-kw','code-type','code-fn',
  'code-str','code-num','code-op','code-cmt','code-err','code-attr'
];

const MAX_THEMES = 30;
const MAX_NAME_LEN = 40;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Code');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: return all themes + version (public, no auth)
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const result = await kv([
        ['get', 'themes'],
        ['get', 'themes-version']
      ]);
      const themes = result[0]?.result ? JSON.parse(result[0].result) : null;
      const version = parseInt(result[1]?.result || '0', 10);
      return res.status(200).json({ themes, version });
    }

    // All write operations require master code
    const code = req.headers['x-master-code'];
    if (!auth(code)) return res.status(403).json({ error: 'unauthorized' });

    const body = await getBody(req);

    // POST: save entire theme set (full replace)
    if (req.method === 'POST') {
      const { themes } = body;
      if (!themes || typeof themes !== 'object') {
        return res.status(400).json({ error: 'themes object required' });
      }

      // validate
      const names = Object.keys(themes);
      if (names.length > MAX_THEMES) {
        return res.status(400).json({ error: `max ${MAX_THEMES} themes` });
      }
      for (const name of names) {
        if (name.length > MAX_NAME_LEN) {
          return res.status(400).json({ error: `theme name too long: ${name}` });
        }
        const vars = themes[name];
        if (!vars || typeof vars !== 'object') {
          return res.status(400).json({ error: `invalid theme: ${name}` });
        }
        // validate each var is a valid-looking CSS color
        for (const v of THEME_VARS) {
          if (vars[v] && typeof vars[v] !== 'string') {
            return res.status(400).json({ error: `invalid value for --${v} in ${name}` });
          }
        }
      }

      await kv([
        ['set', 'themes', JSON.stringify(themes)],
        ['incr', 'themes-version']
      ]);

      const verResult = await kv([['get', 'themes-version']]);
      const version = parseInt(verResult[0]?.result || '1', 10);

      return res.status(200).json({ ok: true, version, count: names.length });
    }

    // PUT: update a single theme
    if (req.method === 'PUT') {
      const { name, vars, rename } = body;
      if (!name) return res.status(400).json({ error: 'name required' });

      const result = await kv([['get', 'themes']]);
      const themes = result[0]?.result ? JSON.parse(result[0].result) : {};

      if (rename) {
        // rename theme
        if (!themes[name]) return res.status(404).json({ error: 'theme not found' });
        if (rename.length > MAX_NAME_LEN) return res.status(400).json({ error: 'name too long' });
        themes[rename] = themes[name];
        delete themes[name];
      } else if (vars) {
        // update/create theme
        if (!themes[name] && Object.keys(themes).length >= MAX_THEMES) {
          return res.status(400).json({ error: `max ${MAX_THEMES} themes` });
        }
        themes[name] = { ...(themes[name] || {}), ...vars };
      }

      await kv([
        ['set', 'themes', JSON.stringify(themes)],
        ['incr', 'themes-version']
      ]);

      const verResult = await kv([['get', 'themes-version']]);
      const version = parseInt(verResult[0]?.result || '1', 10);

      return res.status(200).json({ ok: true, version });
    }

    // DELETE: remove a theme
    if (req.method === 'DELETE') {
      const { name } = body;
      if (!name) return res.status(400).json({ error: 'name required' });

      const result = await kv([['get', 'themes']]);
      const themes = result[0]?.result ? JSON.parse(result[0].result) : {};

      if (!themes[name]) return res.status(404).json({ error: 'theme not found' });
      delete themes[name];

      await kv([
        ['set', 'themes', JSON.stringify(themes)],
        ['incr', 'themes-version']
      ]);

      const verResult = await kv([['get', 'themes-version']]);
      const version = parseInt(verResult[0]?.result || '1', 10);

      return res.status(200).json({ ok: true, version, deleted: name });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[themes]', err.message);
    res.status(500).json({ error: err.message });
  }
};
