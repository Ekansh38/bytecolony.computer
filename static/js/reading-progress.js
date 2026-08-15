// ================================================================
// READING PROGRESS COLUMN + SECTION NAVIGATION RAIL
// - Column of Life-cell squares that fill top→bottom as user scrolls
// - Section dots aligned to each <h2>: hover shows title, click jumps
// - Currently-visible section is highlighted
// ================================================================
(function () {
  if (!document.body.classList.contains('page')) return;

  var CELLS      = 28;   // total cells in the column
  var CELL_SIZE  = 7;    // px per cell (square)

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

  // ── SECTION RAIL ─────────────────────────────────────────────
  var headings = Array.prototype.slice.call(
    document.querySelectorAll('.project-content h2, main h2, article h2')
  );
  // fallback: any h2 inside the page body
  if (headings.length === 0) {
    headings = Array.prototype.slice.call(document.querySelectorAll('h2'));
  }

  var sectionRail = null;
  var sectionDots = [];

  function slugify(text) {
    return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  }

  function buildRail() {
    if (headings.length < 2) return; // not worth showing for <2 sections

    sectionRail = document.createElement('div');
    sectionRail.id = 'section-rail';

    headings.forEach(function (h, idx) {
      // Ensure heading has an id so we can link to it
      if (!h.id) h.id = slugify(h.textContent) || ('section-' + idx);

      var dot = document.createElement('button');
      dot.className = 'section-dot';
      dot.setAttribute('type', 'button');
      dot.setAttribute('aria-label', 'Jump to ' + h.textContent);
      dot.dataset.idx = idx;

      var label = document.createElement('span');
      label.className = 'section-dot-label';
      label.textContent = h.textContent;
      dot.appendChild(label);

      dot.addEventListener('click', function () {
        var top = h.getBoundingClientRect().top + window.scrollY - 24;
        window.scrollTo({ top: top, behavior: 'smooth' });
      });

      sectionRail.appendChild(dot);
      sectionDots.push(dot);
    });

    document.body.appendChild(sectionRail);
    positionDots();
  }

  function positionDots() {
    if (!sectionRail) return;
    var docH = document.documentElement.scrollHeight;
    var winH = window.innerHeight;
    var max  = docH - winH;
    if (max <= 0) return;
    headings.forEach(function (h, idx) {
      var pos = h.getBoundingClientRect().top + window.scrollY;
      var pct = Math.min(1, Math.max(0, pos / max));
      sectionDots[idx].style.top = (pct * 100) + '%';
    });
  }

  function updateActiveSection() {
    if (!sectionRail || headings.length === 0) return;
    var y = window.scrollY + 100; // 100px offset for feel
    var active = 0;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top + window.scrollY <= y) {
        active = i;
      } else {
        break;
      }
    }
    sectionDots.forEach(function (d, i) {
      d.classList.toggle('active', i === active);
    });
  }

  buildRail();
  draw(getProgress());
  updateActiveSection();

  window.addEventListener('scroll', function () {
    draw(getProgress());
    updateActiveSection();
  }, { passive: true });

  window.addEventListener('resize', function () {
    positionDots();
  }, { passive: true });

  // redraw on theme change
  var obs = new MutationObserver(function () {
    refreshColors();
    _lastFilled = -1;
    draw(getProgress());
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
