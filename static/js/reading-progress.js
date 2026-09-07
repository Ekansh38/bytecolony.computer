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
  var DRAG_THRESHOLD = 4;   // px of pointer movement before a press becomes a drag
  var pressY = null;        // clientY at pointerdown
  var fromY = null;         // scroll position when the gesture started
  var dragging = false;

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
    pressY = e.clientY;
    fromY = window.scrollY;
    dragging = false;
    container.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', function (e) {
    if (pressY === null) return;
    if (!dragging && Math.abs(e.clientY - pressY) < DRAG_THRESHOLD) return;
    dragging = true;
    // scrollbar semantics: drag moves relative to where the press started,
    // scaled so the full column height spans the full document.
    // behavior 'instant' — 'auto' obeys the page's CSS scroll-behavior:smooth
    // and turns the drag into a laggy animation.
    var rect = container.getBoundingClientRect();
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var delta = (e.clientY - pressY) / rect.height * max;
    window.scrollTo({ top: Math.min(max, Math.max(0, fromY + delta)), behavior: 'instant' });
  });

  container.addEventListener('pointerup', function (e) {
    if (pressY === null) return;
    var destY = dragging ? window.scrollY : yToScroll(e.clientY);
    if (!dragging) {
      // plain click: jump like a scrollbar track click — no glide
      window.scrollTo({ top: destY, behavior: 'instant' });
    }
    // let the ← back pill offer the way home (only for a meaningful jump)
    if (fromY !== null && Math.abs(destY - fromY) > 40) {
      document.dispatchEvent(new CustomEvent('anchor-return-show', { detail: { fromY: fromY } }));
    }
    pressY = null;
    fromY = null;
    dragging = false;
  });

  container.addEventListener('pointercancel', function () {
    pressY = null;
    fromY = null;
    dragging = false;
  });
})();
