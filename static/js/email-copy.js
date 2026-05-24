document.addEventListener('click', function (e) {
  var el = e.target.closest('.copy-email');
  if (!el) return;
  // don't intercept if the user is selecting the email text
  if (window.getSelection && window.getSelection().toString().length > 0) return;
  var email = el.getAttribute('data-email');
  navigator.clipboard.writeText(email).then(function () {
    var toast = document.getElementById('copy-toast');
    if (!toast) return;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('show'); }, 2000);
  });
});
