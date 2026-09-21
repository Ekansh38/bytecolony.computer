// ================================================================
// LAZY SVG DIAGRAMS
// .svg-diagram[data-svg] placeholders (emitted by the svg shortcode)
// get their SVG fetched and inlined as they approach the viewport.
// Embedded @font-face blocks are stripped — the site serves the
// tldraw font globally. The placeholder carries the real aspect
// ratio, so nothing shifts when the drawing lands.
// ================================================================
(function () {
  var divs = document.querySelectorAll('.svg-diagram[data-svg]');
  if (!divs.length) return;

  function inject(el) {
    if (el.getAttribute('data-svg-loaded')) return;
    el.setAttribute('data-svg-loaded', '1');
    fetch(el.getAttribute('data-svg'))
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        if (!t) return;
        t = t.replace(/@font-face \{[^}]*\}/g, '');
        el.innerHTML = t;
        el.style.removeProperty('aspect-ratio');
      })
      .catch(function () {});
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); inject(e.target); }
      });
    }, { rootMargin: '1200px 0px' });
    divs.forEach(function (d) { io.observe(d); });
  } else {
    divs.forEach(inject);
  }
})();
