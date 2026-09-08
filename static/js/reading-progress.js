// ================================================================
// READING PROGRESS COLUMN
// 28 canvas cells that fill top→bottom as the reader scrolls.
// Clickable and draggable: tap a cell to jump to that point in the
// article, or drag along the column to scrub. Jumps announce
// themselves to anchor-return.js so the ← back pill appears.
// ================================================================
(function () {
  if (!document.body.classList.contains('page')) return;

  var CELLS      = 28;
  var CELL_SIZE  = 7;

  var container = document.createElement('div');
  container.id = 'read-progress';

  var canvases = [];
  var contexts = [];
  for (var i = 0; i < CELLS; i++) {
    var c = document.createElement('canvas');
    c.width  = CELL_SIZE;
    c.height = CELL_SIZE;
    container.appendChild(c);
    canvases.push(c);
    contexts.push(c.getContext('2d'));
  }
  document.body.appendChild(container);

  var _cachedAccent = '';
  var _cachedBorder = '';
  var _lastFilled   = -1;

  function refreshColors() {
    var s = getComputedStyle(document.documentElement);
    _cachedAccent = s.getPropertyValue('--accent').trim();
    _cachedBorder = s.getPropertyValue('--border').trim();
  }
  refreshColors();

  function draw(progress) {
    var filled = Math.round(progress * CELLS);
    if (filled === _lastFilled) return;
    _lastFilled = filled;
    for (var i = 0; i < CELLS; i++) {
      var ctx = contexts[i];
      ctx.clearRect(0, 0, CELL_SIZE, CELL_SIZE);
      if (i < filled) {
        ctx.fillStyle = _cachedAccent;
        ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
      } else {
        ctx.strokeStyle = _cachedBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }

  function getProgress() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docH  = document.documentElement.scrollHeight;
    var winH  = window.innerHeight;
    var max   = docH - winH;
    if (max <= 0) return 1;
    return Math.min(1, Math.max(0, scrollTop / max));
  }

  draw(getProgress());
  window.addEventListener('scroll', function () { draw(getProgress()); }, { passive: true });

  var obs = new MutationObserver(function () {
    refreshColors();
    _lastFilled = -1;
    draw(getProgress());
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ── click / drag navigation ─────────────────────────────────
  // Absolute mapping: the press jumps straight to that point on the
  // column, and dragging keeps the scroll position under the pointer.
  // 'instant' throughout — 'auto' would obey the page's CSS
  // scroll-behavior:smooth and lag behind the pointer.
  var pressing = false;
  var fromY = null;         // scroll position when the gesture started

  function yToScroll(clientY) {
    var rect = container.getBoundingClientRect();
    var p = (clientY - rect.top) / rect.height;
    p = Math.min(1, Math.max(0, p));
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return p * Math.max(0, max);
  }

  container.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    pressing = true;
    fromY = window.scrollY;
    container.setPointerCapture(e.pointerId);
    window.scrollTo({ top: yToScroll(e.clientY), behavior: 'instant' });
  });

  container.addEventListener('pointermove', function (e) {
    if (!pressing) return;
    window.scrollTo({ top: yToScroll(e.clientY), behavior: 'instant' });
  });

  container.addEventListener('pointerup', function () {
    if (!pressing) return;
    // let the ← back pill offer the way home (only for a meaningful jump)
    if (fromY !== null && Math.abs(window.scrollY - fromY) > 40) {
      document.dispatchEvent(new CustomEvent('anchor-return-show', { detail: { fromY: fromY } }));
    }
    pressing = false;
    fromY = null;
  });

  container.addEventListener('pointercancel', function () {
    pressing = false;
    fromY = null;
  });
})();
