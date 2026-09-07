// ================================================================
// PDF VARIANT MENU
// A pdf link carrying data-pdf-light + data-pdf-dark opens a small
// two-choice popover (light / dark) instead of navigating directly.
// Without JS the link falls through to its href (the light build).
// ================================================================
(function () {
  var menu = null;
  var openFor = null;

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'pdf-menu';
    menu.innerHTML =
      '<a class="pdf-menu-item" data-variant="light" target="_blank" rel="noopener">' +
        '<span class="pdf-menu-swatch light"></span>light</a>' +
      '<a class="pdf-menu-item" data-variant="dark" target="_blank" rel="noopener">' +
        '<span class="pdf-menu-swatch dark"></span>dark</a>';
    document.body.appendChild(menu);
    menu.addEventListener('click', function () { hide(); });
    return menu;
  }

  function hide() {
    if (!menu) return;
    menu.classList.remove('open');
    openFor = null;
  }

  function showFor(link) {
    var m = ensureMenu();
    m.querySelector('[data-variant="light"]').href = link.getAttribute('data-pdf-light');
    m.querySelector('[data-variant="dark"]').href = link.getAttribute('data-pdf-dark');
    var r = link.getBoundingClientRect();
    m.style.top = (window.scrollY + r.bottom + 8) + 'px';
    m.style.left = (window.scrollX + r.left) + 'px';
    m.classList.add('open');
    openFor = link;
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('.pdf-theme-link[data-pdf-dark]');
    if (link) {
      e.preventDefault();
      if (openFor === link) { hide(); return; }
      showFor(link);
      return;
    }
    if (menu && !e.target.closest('.pdf-menu')) hide();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
})();
