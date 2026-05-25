// ================================================================
// READING PROGRESS COLUMN
// Shows a column of Life-cell-style squares on article pages
// that fill top→bottom as the user scrolls
// ================================================================
(function () {
  if (!document.body.classList.contains('page')) return;

  var CELLS      = 28;   // total cells in the column
  var CELL_SIZE  = 7;    // px per cell (square)
  var CELL_GAP   = 3;    // gap between cells (must match CSS gap)

  var container = document.createElement('div');
  container.id = 'read-progress';

  // one canvas per cell for simplicity
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

  // redraw on theme change
  var obs = new MutationObserver(function () { refreshColors(); _lastFilled = -1; draw(getProgress()); });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
