(function () {
  var btn = document.createElement('button');
  btn.id = 'anchor-return-btn';
  btn.textContent = '← back';
  btn.setAttribute('aria-label', 'Return to previous position');
  document.body.appendChild(btn);

  var savedY = null;

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href === '#') return;

    savedY = window.scrollY;

    // Two rAF frames: let the browser process the click + scroll before showing
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        btn.classList.add('visible');
      });
    });
  });

  btn.addEventListener('click', function () {
    if (savedY !== null) {
      window.scrollTo({ top: savedY, behavior: 'smooth' });
    }
    savedY = null;
    btn.classList.remove('visible');
  });
})();
