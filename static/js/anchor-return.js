// ================================================================
// FLOATING "← back" PILL
// Appears after the reader jumps around via an in-article anchor
// link OR via a scroll-column section marker. Auto-hides after
// 6 seconds so it doesn't linger.
// ================================================================
(function () {
  var btn = document.createElement('button');
  btn.id = 'anchor-return-btn';
  btn.textContent = '← back';
  btn.setAttribute('aria-label', 'Return to previous position');
  document.body.appendChild(btn);

  var savedY = null;
  var hideTimer = null;
  var AUTO_HIDE_MS = 6000;

  function show(fromY) {
    savedY = fromY;
    clearTimeout(hideTimer);
    // Two rAFs so the pill's transition plays after the scroll starts
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        btn.classList.add('visible');
        hideTimer = setTimeout(hide, AUTO_HIDE_MS);
      });
    });
  }
  function hide() {
    btn.classList.remove('visible');
    clearTimeout(hideTimer);
  }

  // In-article anchor links (e.g. [Diagram 1.4](#diagram-1-4))
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href === '#') return;
    show(window.scrollY);
  });

  // Section-marker jumps from the scroll column (see reading-progress.js)
  document.addEventListener('anchor-return-show', function (e) {
    show((e && e.detail && typeof e.detail.fromY === 'number') ? e.detail.fromY : window.scrollY);
  });

  btn.addEventListener('click', function () {
    if (savedY !== null) {
      window.scrollTo({ top: savedY, behavior: 'smooth' });
    }
    savedY = null;
    hide();
  });
})();
