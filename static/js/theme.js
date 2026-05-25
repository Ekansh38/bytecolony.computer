var THEMES = ['tokyo-night', 'gruvbox', 'dracula', 'rose-pine', 'github-light', 'papercolor-light', 'hacker'];
var LIGHT_THEMES = ['rose-pine', 'github-light', 'papercolor-light'];

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('theme', name);
  if (window._invalidateAccentCache) window._invalidateAccentCache();
  var isLight = LIGHT_THEMES.indexOf(name) >= 0;
  var t = document.getElementById('t');
  if (t) t.textContent = '[theme]';
  var items = document.querySelectorAll('.tp-item, .ms-item');
  for (var i = 0; i < items.length; i++)
    items[i].classList.toggle('active', items[i].getAttribute('data-t') === name);
}

function toggleTheme() {
  var sheet = document.getElementById('m-sheet');
  if (sheet) {
    sheet.classList.add('open');
    return;
  }
  // fallback: cycle
  var cur = document.documentElement.getAttribute('data-theme');
  var idx = THEMES.indexOf(cur);
  applyTheme(THEMES[(idx + 1) % THEMES.length]);
}

(function () {
  var saved = localStorage.getItem('theme') || 'tokyo-night';
  if (saved === 'dark') saved = 'tokyo-night';
  if (saved === 'light') saved = 'rose-pine';
  if (saved === 'solarized-light' || saved === 'flexoki-light' || saved === 'ayu-light') saved = 'github-light';
  if (saved === 'kanagawa') saved = 'dracula';
  if (THEMES.indexOf(saved) < 0) saved = 'tokyo-night';
  applyTheme(saved);

  // ── DB theme loader: fetch once, cache in localStorage ──
  var THEME_VARS = ['bg','fg','muted','accent','border','shadow','code-bg','code-fg','code-kw','code-type','code-fn','code-str','code-num','code-op','code-cmt','code-err','code-attr'];

  function injectDbThemes(themesObj) {
    var id = 'db-themes';
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    var css = '';
    Object.keys(themesObj).forEach(function (name) {
      var vars = themesObj[name];
      css += '[data-theme="' + name + '"] {';
      THEME_VARS.forEach(function (v) {
        if (vars[v]) css += ' --' + v + ': ' + vars[v] + ';';
      });
      css += ' }\n';
    });
    if (css) {
      var style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    }
    // update THEMES array with any new DB themes
    Object.keys(themesObj).forEach(function (name) {
      if (THEMES.indexOf(name) < 0) THEMES.push(name);
    });
  }

  // apply cached themes immediately (no flicker)
  var cached = localStorage.getItem('bc-themes');
  if (cached) { try { injectDbThemes(JSON.parse(cached)); } catch (e) {} }

  // fetch fresh on first visit or reload (non-blocking)
  if (!cached || performance.navigation.type === 1) {
    fetch('/api/themes').then(function (r) { return r.json(); }).then(function (data) {
      if (data.themes) {
        var cachedVer = parseInt(localStorage.getItem('bc-themes-version') || '0', 10);
        if (data.version !== cachedVer || !cached) {
          localStorage.setItem('bc-themes', JSON.stringify(data.themes));
          localStorage.setItem('bc-themes-version', String(data.version));
          injectDbThemes(data.themes);
          // re-apply current theme to pick up changes
          applyTheme(document.documentElement.getAttribute('data-theme'));
        }
      }
    }).catch(function () { /* silent — CSS fallback works fine */ });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(document.documentElement.getAttribute('data-theme'));

    // First-visit theme hint
    if (!localStorage.getItem('theme-hint-seen')) {
      setTimeout(function () {
        var toast = document.getElementById('copy-toast');
        if (!toast) return;
        toast.textContent = 'try typing =';
        toast.classList.add('show');
        setTimeout(function () {
          toast.classList.remove('show');
          localStorage.setItem('theme-hint-seen', '1');
        }, 4000);
      }, 2000);
    }

    // Desktop settings slide-in panel
    var dsOverlay = document.getElementById('ds-overlay');
    var dsPanel   = document.getElementById('ds-panel');
    var dsClose   = document.getElementById('ds-close');
    var dsBtn     = document.getElementById('d-settings-btn');

    function openSettings() {
      if (!dsOverlay || !dsPanel) return;
      dsOverlay.classList.add('open');
      dsPanel.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (window._buildDesktopSettings) window._buildDesktopSettings();
    }
    function closeSettings() {
      if (!dsOverlay || !dsPanel) return;
      dsOverlay.classList.remove('open');
      dsPanel.classList.remove('open');
      document.body.style.overflow = '';
    }

    if (dsBtn) dsBtn.addEventListener('click', openSettings);
    if (dsClose) dsClose.addEventListener('click', closeSettings);
    if (dsOverlay) dsOverlay.addEventListener('click', closeSettings);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dsPanel && dsPanel.classList.contains('open')) closeSettings();
      if (e.key === '=' && !e.ctrlKey && !e.metaKey && !e.altKey &&
          e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (dsPanel && dsPanel.classList.contains('open')) closeSettings();
        else openSettings();
      }
    });

    // Mobile settings sheet
    var mSheet = document.getElementById('m-sheet');
    var mPanel = document.getElementById('m-sheet-panel');
    if (mSheet && mPanel) {
      // tap backdrop to close
      mSheet.addEventListener('click', function (e) {
        if (e.target === mSheet) mSheet.classList.remove('open');
      });
      // tap theme item
      var mItems = mPanel.querySelectorAll('.ms-item');
      for (var j = 0; j < mItems.length; j++) {
        mItems[j].addEventListener('click', (function (item) {
          return function () {
            applyTheme(item.getAttribute('data-t'));
          };
        })(mItems[j]));
      }
    }
  });
})();

