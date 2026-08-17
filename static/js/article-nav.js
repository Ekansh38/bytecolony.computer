// ================================================================
// ARTICLE NAVIGATION (sticky pill + overlay)
// ================================================================
(function () {
  // Collect h2s inside the article, EXCLUDING the comments-section
  // heading (which is itself a nav target we add manually as "comments").
  function collectHeadings() {
    var scope = document.querySelector('main, article, .project-content') || document.body;
    var all = Array.prototype.slice.call(scope.querySelectorAll('h2'));
    return all.filter(function (h) {
      return !h.closest('header, nav, footer, aside, .comments-section, .article-nav');
    });
  }

  var headings = collectHeadings();
  if (headings.length < 2) return;

  var meta = document.querySelector('.project-meta');
  var commentsEl = document.getElementById('comments');
  var titleEl = document.querySelector('.project-title, h1');

  function slugify(text) {
    return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  }

  // "Intro" if prose exists between title and first h2
  var hasIntro = false;
  var prev = headings[0].previousElementSibling;
  while (prev) {
    if (prev.textContent && prev.textContent.trim().length > 0) { hasIntro = true; break; }
    prev = prev.previousElementSibling;
  }

  headings.forEach(function (h, i) {
    if (!h.id) h.id = slugify(h.textContent) || ('section-' + i);
  });

  var entries = [];
  if (hasIntro) {
    entries.push({
      label: 'Intro',
      key: 'intro',
      getTop: function () { return titleEl ? titleEl.getBoundingClientRect().top + window.scrollY - 24 : 0; },
      target: titleEl || document.body
    });
  }
  headings.forEach(function (h) {
    entries.push({
      label: h.textContent,
      key: h.id,
      getTop: function () { return h.getBoundingClientRect().top + window.scrollY - 24; },
      target: h
    });
  });
  if (commentsEl) {
    entries.push({
      label: 'comments',
      key: 'comments',
      getTop: function () { return commentsEl.getBoundingClientRect().top + window.scrollY - 24; },
      target: commentsEl,
      isComments: true
    });
  }

  function jumpTo(entry) {
    var fromY = window.scrollY;
    var top = Math.max(0, entry.getTop());
    window.scrollTo({ top: top, behavior: 'smooth' });
    if (Math.abs(fromY - top) > 200) {
      document.dispatchEvent(new CustomEvent('anchor-return-show', { detail: { fromY: fromY } }));
    }
  }

  // ── 1. Sticky mini-pill ────────────────────────────────────
  var pill = document.createElement('button');
  pill.className = 'toc-pill';
  pill.type = 'button';
  pill.setAttribute('aria-label', 'Open table of contents');
  var pillIcon = document.createElement('span');
  pillIcon.className = 'toc-pill-icon';
  pillIcon.textContent = '≡';
  var pillLabel = document.createElement('span');
  pillLabel.className = 'toc-pill-label';
  pillLabel.textContent = entries[0].label;
  pill.appendChild(pillIcon);
  pill.appendChild(pillLabel);
  document.body.appendChild(pill);

  // ── 3. Fullscreen overlay ──────────────────────────────────
  var overlay = document.createElement('div');
  overlay.className = 'toc-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  var overlayPanel = document.createElement('div');
  overlayPanel.className = 'toc-overlay-panel';
  overlayPanel.setAttribute('role', 'dialog');
  overlayPanel.setAttribute('aria-modal', 'true');
  overlayPanel.setAttribute('aria-label', 'Table of contents');
  var overlayTitle = document.createElement('div');
  overlayTitle.className = 'toc-overlay-title';
  overlayTitle.textContent = '── table of contents ──';
  overlayPanel.appendChild(overlayTitle);
  var overlayList = document.createElement('ol');
  overlayList.className = 'toc-overlay-list';
  entries.forEach(function (entry) {
    var li = document.createElement('li');
    li.className = 'toc-overlay-item' + (entry.isComments ? ' is-comments' : '');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'toc-overlay-link';
    b.textContent = entry.isComments ? 'comments ↓' : entry.label;
    b.addEventListener('click', function () {
      closeOverlay();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { jumpTo(entry); });
      });
    });
    li.appendChild(b);
    overlayList.appendChild(li);
    entry.overlayItem = b;
  });
  overlayPanel.appendChild(overlayList);
  overlay.appendChild(overlayPanel);
  document.body.appendChild(overlay);

  function openOverlay() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeOverlay() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  pill.addEventListener('click', openOverlay);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeOverlay();
  });

  // ── Scroll tracking ────────────────────────────────────────
  // Pill becomes visible after the reader scrolls past the article title
  var pillThreshold = 0;
  function recomputeThreshold() {
    var el = meta || titleEl;
    if (el) pillThreshold = el.getBoundingClientRect().bottom + window.scrollY;
    else pillThreshold = 100;
  }
  recomputeThreshold();

  function currentEntryIdx() {
    // Switch section as soon as the heading crosses into the middle of the
    // viewport (0.6 = top 60% of screen). Feels responsive — the pill
    // switches BEFORE you start reading the section.
    var y = window.scrollY + window.innerHeight * 0.6;
    var active = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.isComments) continue;
      var top = e.target === document.body ? 0 : e.target.getBoundingClientRect().top + window.scrollY;
      if (top <= y) active = i;
      else break;
    }
    return active;
  }

  function updateActive() {
    var idx = currentEntryIdx();
    entries.forEach(function (e, i) {
      var isActive = i === idx;
      if (e.overlayItem) e.overlayItem.classList.toggle('active', isActive);
    });
    pillLabel.textContent = entries[idx].label;
  }

  function updatePillVisibility() {
    var shouldShow = window.scrollY > pillThreshold - 40;
    pill.classList.toggle('visible', shouldShow);
  }

  updateActive();
  updatePillVisibility();

  window.addEventListener('scroll', function () {
    updateActive();
    updatePillVisibility();
  }, { passive: true });
  window.addEventListener('resize', function () {
    recomputeThreshold();
    updatePillVisibility();
  }, { passive: true });
  window.addEventListener('load', function () {
    recomputeThreshold();
    updatePillVisibility();
    updateActive();
  });
})();
