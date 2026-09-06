// ================================================================
// ANALYTICS — thin client tracker for /api/beacon
// Fires:
//   view   on every page load (once per session per path — the pageview)
//   depth  on page-hide / unload, with the max scroll depth reached
// Skips:
//   - localStorage.bc_internal = '1'  (set via :internal on in the terminal)
//   - navigator.webdriver             (Lighthouse, headless browsers)
//   - localhost / vercel preview hostnames
//   - the /admin page itself
// ================================================================
(function () {
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

  var ref = '';
  if (document.referrer) {
    try {
      var r = new URL(document.referrer);
      if (r.origin !== location.origin) ref = r.origin;
    } catch (e) {}
  }

  beacon({ event: 'view', path: path, ref: ref });

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
