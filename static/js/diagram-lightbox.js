// ================================================================
// DIAGRAM LIGHTBOX
// Click any .svg-diagram to enlarge it in a blurred-backdrop overlay,
// with the caption from the following <p><em>...</em></p> shown below.
// ESC or click on the backdrop to close.
// ================================================================
(function () {
  var overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'diagram-lightbox';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<button class="diagram-lightbox-close" type="button" aria-label="Close">esc</button>' +
      '<div class="diagram-lightbox-inner" role="dialog" aria-modal="true" aria-label="Diagram viewer">' +
        '<div class="diagram-lightbox-panel"></div>' +
        '<div class="diagram-lightbox-caption"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    function close() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-open');
    }

    overlay.querySelector('.diagram-lightbox-close').addEventListener('click', close);
    // Backdrop click closes; clicks inside the inner panel don't propagate as overlay target
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
    return overlay;
  }

  function openLightbox(diagram) {
    var ov = ensureOverlay();
    var panel = ov.querySelector('.diagram-lightbox-panel');
    var captionEl = ov.querySelector('.diagram-lightbox-caption');

    // Clone the inner SVG or IMG so the article version isn't disturbed
    panel.innerHTML = '';
    var content = diagram.querySelector('svg, img');
    if (content) {
      var clone = content.cloneNode(true);
      // Strip inline width/height so CSS constraints in the lightbox win
      clone.removeAttribute('width');
      clone.removeAttribute('height');
      panel.appendChild(clone);
    }

    // Grab caption from the immediately-following <p> (which contains the italic diagram label)
    var next = diagram.nextElementSibling;
    var captionText = '';
    if (next && next.tagName === 'P') {
      captionText = next.textContent.trim();
    }
    captionEl.textContent = captionText;
    captionEl.style.display = captionText ? '' : 'none';

    ov.classList.add('open');
    ov.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
  }

  // Delegate clicks — one listener regardless of how many diagrams there are
  document.addEventListener('click', function (e) {
    var diagram = e.target.closest('.svg-diagram');
    if (!diagram) return;
    // Don't hijack real links inside a diagram (defensive; none today)
    if (e.target.closest('a')) return;
    e.preventDefault();
    openLightbox(diagram);
  });
})();
