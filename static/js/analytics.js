// ================================================================
// ANALYTICS — thin client tracker for /api/beacon
// Fires:
//   view   on every page load (the pageview), with a source: either a
//          ?ref= campaign tag or the external referrer's origin
//   depth  on page-hide / unload, with the max scroll depth reached
// Skips (self-exclusion):
//   - localStorage.bc_internal = '1', set by any of:
//       * visiting any page with ?internal=1
//       * logging in to /admin (see theme-editor.html)
//       * the `internal on` terminal command
//   - navigator.webdriver             (Lighthouse, headless browsers)
//   - localhost / vercel preview hostnames
//   - the /admin page itself
// ================================================================
(function () {
  // ?internal=1 marks this browser as the author's, from any device,
  // without needing the terminal. ?internal=0 undoes it.
  try {
    var qp = new URLSearchParams(location.search);
    if (qp.has('internal')) {
      var on = qp.get('internal') !== '0';
      if (on) localStorage.setItem('bc_internal', '1');
      else localStorage.removeItem('bc_internal');
      qp.delete('internal');
      var q = qp.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }
  } catch (e) {}

  try {
    if (localStorage.getItem('bc_internal') === '1') return;
  } catch (e) {}
  if (navigator.webdriver) return;

  var host = (location.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return;
  // Vercel preview deploys — count only production
  if (/\.vercel\.app$/.test(host) && host !== 'bytecolony.computer') return;

  var path = location.pathname.replace(/\/index\.html$/, '/').replace(/\/{2,}/g, '/');
  if (!path) path = '/';
  if (path.indexOf('/admin') === 0) return;

  function beacon(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/beacon', blob);
      } else {
        fetch('/api/beacon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  // Source of this visit. A ?ref= tag wins over the browser referrer,
  // since it was deliberately minted for a specific place a link was
  // shared — and it works for Discord/email/etc, which send no referrer.
  var ref = '';
  var tag = '';
  try {
    var t = new URLSearchParams(location.search).get('ref');
    if (t) tag = t.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  } catch (e) {}

  if (!tag && document.referrer) {
    try {
      var r = new URL(document.referrer);
      if (r.origin !== location.origin) ref = r.origin;
    } catch (e) {}
  }

  beacon({ event: 'view', path: path, ref: ref, tag: tag });

  // Keep the shared URL clean once the tag is recorded, so a reader
  // copying it out of the address bar doesn't re-attribute to the tag.
  if (tag) {
    try {
      var qp2 = new URLSearchParams(location.search);
      qp2.delete('ref');
      var q2 = qp2.toString();
      history.replaceState(null, '', location.pathname + (q2 ? '?' + q2 : '') + location.hash);
    } catch (e) {}
  }

  // Depth tracker — only on writing pages (articles) and project pages
  var isArticle =
    /^\/writing\//.test(path) ||
    /^\/projects\//.test(path) ||
    document.body.classList.contains('writing');
  if (!isArticle) return;

  var maxDepth = 0;
  var sent = false;

  function measure() {
    var doc = document.documentElement;
    var h = doc.scrollHeight || document.body.scrollHeight || 0;
    if (h <= 0) return;
    var bottom = (window.scrollY || window.pageYOffset || 0) + window.innerHeight;
    var d = Math.max(0, Math.min(100, Math.round(bottom / h * 100)));
    if (d > maxDepth) maxDepth = d;
  }

  function send() {
    if (sent) return;
    measure();
    if (maxDepth <= 0) return;
    sent = true;
    beacon({ event: 'depth', path: path, depth: maxDepth });
  }

  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure, { passive: true });

  // pagehide fires more reliably on mobile Safari than beforeunload
  window.addEventListener('pagehide', send);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') send();
  });
})();
