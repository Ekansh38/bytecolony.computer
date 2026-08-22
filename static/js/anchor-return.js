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
  // Smooth-scroll to target + show the ← back pill.
  document.addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href === '#') return;

    var target = document.getElementById(href.slice(1));
    if (!target) return;                       // let browser handle bad hrefs

    e.preventDefault();
    var fromY = window.scrollY;
    var top = target.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    // Update the URL hash without triggering another jump
    if (history && history.pushState) history.pushState(null, '', href);
    show(fromY);
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
