// ── DIAGRAM OVERLAY (option-2-diagram-overlay) ──────────────────
(function () {
  var overlay = document.getElementById('diagram-overlay');
  if (!overlay) return;
  var content = document.getElementById('diagram-overlay-content');
  var caption = document.getElementById('diagram-overlay-caption');
  var closeBtn = document.getElementById('diagram-overlay-close');

  function openOverlay(el, captionText) {
    content.innerHTML = '';
    content.appendChild(el.cloneNode(true));
    caption.textContent = captionText || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function isContentBlock(el) {
    if (!el) return false;
    return (
      el.classList.contains('svg-diagram') ||
      el.tagName === 'PRE' ||
      el.tagName === 'TABLE' ||
      el.tagName === 'FIGURE'
    );
  }

  function findContent(anchor) {
    // Try direct next element sibling
    var el = anchor.nextElementSibling;
    if (isContentBlock(el)) return el;
    // Anchor is usually inside a <p> — check parent's next sibling
    var par = anchor.parentElement;
    if (par) {
      el = par.nextElementSibling;
      if (isContentBlock(el)) return el;
    }
    return null;
  }

  closeBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOverlay();
  });

  document.addEventListener('click', function (e) {
    // Cmd (Mac) or Ctrl = bypass, navigate normally
    if (e.metaKey || e.ctrlKey) return;

    var link = e.target.closest('a[href^="#"]');
    if (!link) return;

    var id = link.getAttribute('href').slice(1);
    if (!id) return;

    var anchor = document.getElementById(id);
    if (!anchor) return;

    var el = findContent(anchor);
    if (!el) return; // no content block found — let it navigate

    e.preventDefault();

    // Caption: next <p> after the content block (for diagrams)
    var captionEl = el.nextElementSibling;
    var captionText = (captionEl && captionEl.tagName === 'P') ? captionEl.textContent : '';

    openOverlay(el, captionText);
  });
})();
// ── END DIAGRAM OVERLAY (option-2-diagram-overlay) ──────────────
