// ── DIAGRAM OVERLAY (option-2-diagram-overlay) ──────────────────
(function () {
  var overlay = document.getElementById('diagram-overlay');
  if (!overlay) return;
  var content = document.getElementById('diagram-overlay-content');
  var caption = document.getElementById('diagram-overlay-caption');
  var closeBtn = document.getElementById('diagram-overlay-close');

  function openOverlay(svgEl, captionText) {
    content.innerHTML = '';
    content.appendChild(svgEl.cloneNode(true));
    caption.textContent = captionText || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOverlay();
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#diagram-"]');
    if (!link) return;

    var id = link.getAttribute('href').slice(1);
    var anchor = document.getElementById(id);
    if (!anchor) return;

    // Hugo wraps the anchor in a <p>, so .svg-diagram is the next sibling of that <p>
    var svgEl = anchor.nextElementSibling;
    if (!svgEl || !svgEl.classList.contains('svg-diagram')) {
      var par = anchor.parentElement;
      svgEl = par ? par.nextElementSibling : null;
    }
    if (!svgEl || !svgEl.classList.contains('svg-diagram')) return;

    e.preventDefault();

    // Caption is the next <p> after the .svg-diagram
    var captionEl = svgEl.nextElementSibling;
    var captionText = (captionEl && captionEl.tagName === 'P') ? captionEl.textContent : '';

    openOverlay(svgEl, captionText);
  });
})();
// ── END DIAGRAM OVERLAY (option-2-diagram-overlay) ──────────────
