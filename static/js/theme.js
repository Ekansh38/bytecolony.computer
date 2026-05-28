var THEMES = ['tokyo-night', 'gruvbox', 'dracula', 'rose-pine', 'github-light', 'papercolor-light', 'hacker'];
var LIGHT_THEMES = ['rose-pine', 'github-light', 'papercolor-light'];

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('theme', name);
  if (window._invalidateAccentCache) window._invalidateAccentCache();
  var isLight = LIGHT_THEMES.indexOf(name) >= 0;
  var t = document.getElementById('t');
  if (t) t.textContent = isLight ? '[light]' : '[dark]';
  var items = document.querySelectorAll('.tp-item');
  for (var i = 0; i < items.length; i++)
    items[i].classList.toggle('active', items[i].getAttribute('data-t') === name);
}

function toggleTheme() {
  var isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (isMobile) {
    var cur = document.documentElement.getAttribute('data-theme');
    var isLight = LIGHT_THEMES.indexOf(cur) >= 0;
    applyTheme(isLight ? 'tokyo-night' : 'github-light');
    return;
  }
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

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(document.documentElement.getAttribute('data-theme'));

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

  });
})();

