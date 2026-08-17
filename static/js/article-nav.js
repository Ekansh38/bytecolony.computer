// ================================================================
// ARTICLE NAVIGATION (inline TOC + sticky pill + overlay)
//
// On pages with 2+ h2s:
//   1. Injects an inline "contents" block right after the article
//      meta line — readers see the full outline before diving in.
//   2. Once the reader scrolls past that inline block, a small
//      sticky pill fades in at bottom-right showing the current
//      section name. Click it → fullscreen overlay with all
//      sections + comments jump.
//   3. Every jump plays nice with anchor-return.js (back button).
// ================================================================
(function () {
  var headings = Array.prototype.slice.call(document.querySelectorAll('main h2, article h2, .project-content h2'));
  if (headings.length === 0) {
    headings = Array.prototype.slice.call(document.querySelectorAll('body h2'))
      .filter(function (h) { return !h.closest('header, nav, footer, aside, .comments-section, .article-nav'); });
  }
  if (headings.length < 2) return;

  var meta = document.querySelector('.project-meta');
  if (!meta) return;

  var commentsEl = document.getElementById('comments');
  var titleEl = document.querySelector('.project-title, h1');

  function slugify(text) {
    return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  }

  // Detect "Intro" — prose exists between title and first h2
  var hasIntro = false;
  var prev = headings[0].previousElementSibling;
  while (prev) {
    if (prev.textContent && prev.textContent.trim().length > 0) { hasIntro = true; break; }
    prev = prev.previousElementSibling;
  }

  // Ensure ids on all h2s
  headings.forEach(function (h, i) {
    if (!h.id) h.id = slugify(h.textContent) || ('section-' + i);
  });

  // Model of TOC entries: [{label, target(fn returning number top), key}]
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

  // ── 1. Inline TOC block right after .project-meta ─────────────
  var inline = document.createElement('nav');
  inline.className = 'inline-toc';
  inline.setAttribute('aria-label', 'Table of contents');
  var inlineTitle = document.createElement('div');
  inlineTitle.className = 'inline-toc-title';
  inlineTitle.textContent = 'CONTENTS';
  inline.appendChild(inlineTitle);
  var inlineList = document.createElement('ul');
  inlineList.className = 'inline-toc-list';
  entries.forEach(function (entry) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = entry.isComments ? '#comments' : '#' + entry.key;
    a.textContent = entry.isComments ? 'comments ↓' : entry.label;
    if (entry.isComments) a.className = 'inline-toc-comments';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      jumpTo(entry);
    });
    li.appendChild(a);
    inlineList.appendChild(li);
    entry.inlineLink = a;
  });
  inline.appendChild(inlineList);
  meta.insertAdjacentElement('afterend', inline);

  // ── 2. Sticky mini-pill (appears after scrolling past inline TOC)
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

  // ── 3. Overlay with full section list ────────────────────────
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
  overlayTitle.textContent = 'CONTENTS';
  overlayPanel.appendChild(overlayTitle);
  var overlayList = document.createElement('ul');
  overlayList.className = 'toc-overlay-list';
  entries.forEach(function (entry) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'toc-overlay-item' + (entry.isComments ? ' is-comments' : '');
    b.textContent = entry.isComments ? 'comments ↓' : entry.label;
    b.addEventListener('click', function () {
      closeOverlay();
      // Delay jump slightly so the overlay close animation feels smooth
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

  // ── Scroll tracking: show pill after inline TOC is out of view;
  //    update current section for pill + overlay + inline list ──
  var inlineBottom = 0;
  function recomputeInlineBottom() {
    inlineBottom = inline.getBoundingClientRect().bottom + window.scrollY;
  }
  recomputeInlineBottom();

  function currentEntryIdx() {
    // Active = last non-comments entry whose position <= scrollY + 40% viewport
    var y = window.scrollY + window.innerHeight * 0.4;
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
      if (e.inlineLink) e.inlineLink.classList.toggle('active', isActive);
      if (e.overlayItem) e.overlayItem.classList.toggle('active', isActive);
    });
    pillLabel.textContent = entries[idx].label;
  }

  function updatePillVisibility() {
    // Show pill only when we've scrolled past the inline TOC block
    var shouldShow = window.scrollY > inlineBottom - 40;
    pill.classList.toggle('visible', shouldShow);
  }

  updateActive();
  updatePillVisibility();

  window.addEventListener('scroll', function () {
    updateActive();
    updatePillVisibility();
  }, { passive: true });
  window.addEventListener('resize', function () {
    recomputeInlineBottom();
    updatePillVisibility();
  }, { passive: true });
  window.addEventListener('load', function () {
    recomputeInlineBottom();
    updatePillVisibility();
    updateActive();
  });
})();
