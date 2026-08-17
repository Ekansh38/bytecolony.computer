// ================================================================
// TABLE OF CONTENTS PANEL
// Slide-in panel with jump-to-section links, opened via [toc] button.
// Only activates on pages with 2+ h2 headings.
// ================================================================
(function () {
  var headings = Array.prototype.slice.call(document.querySelectorAll('main h2, article h2, .project-content h2'));
  if (headings.length === 0) {
    // fallback: any h2 in the body (not in header/nav/footer)
    headings = Array.prototype.slice.call(document.querySelectorAll('body h2'))
      .filter(function (h) { return !h.closest('header, nav, footer, aside'); });
  }
  if (headings.length < 2) return;

  var btn      = document.getElementById('toc-btn');
  var overlay  = document.getElementById('toc-overlay');
  var panel    = document.getElementById('toc-panel');
  var closeBtn = document.getElementById('toc-close');
  var listEl   = document.getElementById('toc-list');
  if (!btn || !overlay || !panel || !listEl) return;

  btn.style.display = '';

  function slugify(text) {
    return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  }

  // Detect whether there's article prose BEFORE the first heading.
  // If so, prepend an "Intro" entry that scrolls to the top of the article.
  var firstH = headings[0];
  var hasIntro = false;
  var prev = firstH.previousElementSibling;
  while (prev) {
    if (prev.textContent && prev.textContent.trim().length > 0) { hasIntro = true; break; }
    prev = prev.previousElementSibling;
  }

  var items = [];
  var trackedHeadings = [];

  if (hasIntro) {
    var introA = document.createElement('a');
    introA.className = 'toc-item';
    introA.href = '#';
    introA.textContent = 'Intro';
    introA.addEventListener('click', function (e) {
      e.preventDefault();
      // Scroll to the article title (h1) if there is one, else top of page
      var title = document.querySelector('.project-title, h1');
      var top = title ? title.getBoundingClientRect().top + window.scrollY - 24 : 0;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      closePanel();
    });
    listEl.appendChild(introA);
    items.push(introA);
    // Represent Intro with the title element (or null → uses scrollY 0)
    trackedHeadings.push(document.querySelector('.project-title, h1') || document.body);
  }

  headings.forEach(function (h, idx) {
    if (!h.id) h.id = slugify(h.textContent) || ('section-' + idx);
    var a = document.createElement('a');
    a.className = 'toc-item';
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var top = h.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: top, behavior: 'smooth' });
      closePanel();
    });
    listEl.appendChild(a);
    items.push(a);
    trackedHeadings.push(h);
  });

  function openPanel() {
    overlay.classList.add('open');
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closePanel() {
    overlay.classList.remove('open');
    panel.classList.remove('open');
    document.body.style.overflow = '';
    btn.focus({ preventScroll: true });
  }

  btn.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
  });

  // Track the currently-visible section (uses trackedHeadings which may include the Intro anchor)
  function updateActive() {
    var y = window.scrollY + 120;
    var active = 0;
    for (var i = 0; i < trackedHeadings.length; i++) {
      var el = trackedHeadings[i];
      var pos = el === document.body ? 0 : el.getBoundingClientRect().top + window.scrollY;
      if (pos <= y) active = i;
      else break;
    }
    items.forEach(function (a, i) {
      a.classList.toggle('active', i === active);
    });
  }
  updateActive();
  window.addEventListener('scroll', updateActive, { passive: true });
})();
