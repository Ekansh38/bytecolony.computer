// ================================================================
// LAZY SVG DIAGRAMS — prefetch + paced injection
//
// Placeholders (.svg-diagram[data-svg], emitted by the svg shortcode)
// are hydrated in three decoupled stages so the page never freezes:
//
//   1. PREFETCH  — after load, all diagram SVG text is fetched
//      sequentially at low network priority and cached. Scrolling
//      never waits on the network.
//   2. QUEUE     — an IntersectionObserver marks diagrams nearing the
//      viewport as wanted.
//   3. INJECT    — queued diagrams are parsed into the DOM one at a
//      time, each inside its own animation frame, and NEVER while the
//      user is actively scrolling. Injection is the expensive part
//      (layout of thousands of SVG paths), so it's paced and yielded.
//
// Placeholders keep their exact aspect ratio and show a shimmer until
// hydrated. window._svgLazyEnsure(el) lets the lightbox force-load a
// diagram on demand (user intent beats the queue).
// ================================================================
(function () {
  var divs = [].slice.call(document.querySelectorAll('.svg-diagram[data-svg]'));
  if (!divs.length) return;

  var cache = {};          // url -> Promise<string>
  var queue = [];          // elements waiting for injection
  var queued = new Set();
  var injecting = false;
  var scrolling = false;
  var scrollTimer = null;

  function fetchSvg(url) {
    if (cache[url]) return cache[url];
    var opts = {};
    try { opts = { priority: 'low' }; } catch (e) {}
    cache[url] = fetch(url, opts)
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { return t.replace(/@font-face \{[^}]*\}/g, ''); })
      .catch(function () { return ''; });
    return cache[url];
  }

  function inject(el) {
    if (el.getAttribute('data-svg-done')) return Promise.resolve();
    el.setAttribute('data-svg-done', '1');
    return fetchSvg(el.getAttribute('data-svg')).then(function (t) {
      return new Promise(function (resolve) {
        requestAnimationFrame(function () {
          if (t) {
            el.innerHTML = t;
            el.style.removeProperty('aspect-ratio');
            el.classList.add('svg-loaded');
          }
          resolve();
        });
      });
    });
  }

  function pump() {
    if (injecting || scrolling) return;
    var el = queue.shift();
    if (!el) return;
    injecting = true;
    inject(el).then(function () {
      injecting = false;
      // breathe between injections so input/scroll stays responsive
      setTimeout(pump, 60);
    });
  }

  function want(el) {
    if (queued.has(el) || el.getAttribute('data-svg-done')) return;
    queued.add(el);
    queue.push(el);
    pump();
  }

  // pause hydration while the user is actively scrolling
  window.addEventListener('scroll', function () {
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      scrolling = false;
      pump();
    }, 150);
  }, { passive: true });

  // stage 2: mark diagrams as wanted well before they arrive
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); want(e.target); }
      });
    }, { rootMargin: '2000px 0px' });
    divs.forEach(function (d) { io.observe(d); });
  } else {
    divs.forEach(want);
  }

  // stage 1: background-prefetch every diagram's text, one at a time,
  // starting once the page has settled
  function prefetchAll() {
    var i = 0;
    (function next() {
      if (i >= divs.length) return;
      var url = divs[i].getAttribute('data-svg');
      i++;
      fetchSvg(url).then(function () { setTimeout(next, 100); });
    })();
  }
  if (document.readyState === 'complete') setTimeout(prefetchAll, 800);
  else window.addEventListener('load', function () { setTimeout(prefetchAll, 800); });

  // user intent: the lightbox (or anything else) can demand a diagram now
  window._svgLazyEnsure = function (el) {
    queued.add(el);
    return inject(el);
  };
})();
