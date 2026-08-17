// ================================================================
// READING PROGRESS COLUMN + SECTION / COMMENTS NAVIGATION
//
// - 28 canvas cells that fill top→bottom as you scroll (reading progress)
// - Section ticks aligned to each <h2> position in the article
// - Comments tick at the bottom (if comments section exists)
// - Hover the column area → all section labels fade in with backdrop blur
// - Click a tick → smooth scroll to that section
// - Currently-visible section stays highlighted (with label always shown)
// ================================================================
(function () {
  if (!document.body.classList.contains('page')) return;

  var CELLS      = 28;
  var CELL_SIZE  = 7;

  // ─── Build the container with a hidden hover hitbox on the left ─────
  var container = document.createElement('div');
  container.id = 'read-progress';

  var cellsWrap = document.createElement('div');
  cellsWrap.className = 'rp-cells';

  var canvases = [];
  var contexts = [];
  for (var i = 0; i < CELLS; i++) {
    var c = document.createElement('canvas');
    c.width  = CELL_SIZE;
    c.height = CELL_SIZE;
    cellsWrap.appendChild(c);
    canvases.push(c);
    contexts.push(c.getContext('2d'));
  }
  container.appendChild(cellsWrap);

  var markersWrap = document.createElement('div');
  markersWrap.className = 'rp-markers';
  container.appendChild(markersWrap);

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

  // ─── Section + comments markers ─────────────────────────────────────
  var headings = Array.prototype.slice.call(
    document.querySelectorAll('main h2, article h2, .project-content h2')
  );
  if (headings.length === 0) {
    headings = Array.prototype.slice.call(document.querySelectorAll('body h2'))
      .filter(function (h) { return !h.closest('header, nav, footer, aside, .comments-section'); });
  }

  var commentsEl = document.getElementById('comments');
  var showMarkers = headings.length >= 1 || commentsEl;

  function slugify(text) {
    return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  }

  var markers = []; // { el, target, label }

  function createMarker(target, label, extraClass) {
    var btn = document.createElement('button');
    btn.className = 'rp-mark' + (extraClass ? ' ' + extraClass : '');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Jump to ' + label);

    var tick = document.createElement('span');
    tick.className = 'rp-mark-tick';
    btn.appendChild(tick);

    var lbl = document.createElement('span');
    lbl.className = 'rp-mark-label';
    lbl.textContent = label;
    btn.appendChild(lbl);

    btn.addEventListener('click', function () {
      var top;
      if (target === document.body) {
        top = 0;
      } else {
        top = target.getBoundingClientRect().top + window.scrollY - 24;
      }
      var fromY = window.scrollY;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      // Show the "← back" pill so the reader can return to where they were
      if (Math.abs(fromY - top) > 200) {
        document.dispatchEvent(new CustomEvent('anchor-return-show', { detail: { fromY: fromY } }));
      }
    });

    markersWrap.appendChild(btn);
    return btn;
  }

  if (showMarkers) {
    headings.forEach(function (h, idx) {
      if (!h.id) h.id = slugify(h.textContent) || ('section-' + idx);
      var el = createMarker(h, h.textContent);
      markers.push({ el: el, target: h, label: h.textContent, isComments: false });
    });
    if (commentsEl) {
      var el = createMarker(commentsEl, 'comments', 'rp-mark-comments');
      markers.push({ el: el, target: commentsEl, label: 'comments', isComments: true });
    }
  }

  function positionMarkers() {
    if (!showMarkers) return;
    var docH = document.documentElement.scrollHeight;
    var winH = window.innerHeight;
    var max  = docH - winH;
    if (max <= 0) return;
    markers.forEach(function (m) {
      var elTop = m.target.getBoundingClientRect().top + window.scrollY;
      var pct = Math.min(1, Math.max(0, elTop / max));
      m.el.style.top = (pct * 100) + '%';
    });
  }

  function updateActive() {
    if (!showMarkers) return;
    // Trigger "active" when the heading has crossed 40% into the viewport —
    // makes the label pop up as the section enters view, not after we pass it.
    var y = window.scrollY + window.innerHeight * 0.4;
    var active = -1;
    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      if (m.isComments) continue; // comments doesn't participate in "current section"
      var pos = m.target.getBoundingClientRect().top + window.scrollY;
      if (pos <= y) active = i;
      else break;
    }
    markers.forEach(function (m, i) {
      m.el.classList.toggle('active', i === active);
    });
  }

  // Cursor-Y proximity: on hover of the column, show ONLY the label
  // nearest to the cursor's vertical position. Prevents label pile-up
  // when many sections crowd into a short scroll area.
  function updateCursorTarget(clientY) {
    if (!showMarkers) return;
    var minDist = Infinity;
    var closest = null;
    for (var i = 0; i < markers.length; i++) {
      var r = markers[i].el.getBoundingClientRect();
      var mid = r.top + r.height / 2;
      var d = Math.abs(clientY - mid);
      if (d < minDist) { minDist = d; closest = markers[i]; }
    }
    markers.forEach(function (m) { m.el.classList.toggle('cursor-target', m === closest); });
  }
  function clearCursorTarget() {
    markers.forEach(function (m) { m.el.classList.remove('cursor-target'); });
  }
  container.addEventListener('mousemove', function (e) { updateCursorTarget(e.clientY); });
  container.addEventListener('mouseleave', clearCursorTarget);

  positionMarkers();
  draw(getProgress());
  updateActive();

  window.addEventListener('scroll', function () {
    draw(getProgress());
    updateActive();
  }, { passive: true });

  window.addEventListener('resize', function () {
    positionMarkers();
  }, { passive: true });

  // Recompute positions after content settles (images, fonts)
  window.addEventListener('load', function () { positionMarkers(); updateActive(); });

  // redraw on theme change
  var obs = new MutationObserver(function () {
    refreshColors();
    _lastFilled = -1;
    draw(getProgress());
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
