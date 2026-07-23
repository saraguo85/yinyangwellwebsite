// Fillout intake modal: any element with data-fillout-open opens the intake form in an on-site overlay.
// Uses Fillout's official embed script (renders inside our own modal shell) so we stay on their
// supported embed path instead of iframing forms.fillout.com directly (which is CSP-restricted).
(function () {
  var FORM_ID = '94MTXD2bFeus';
  var EMBED_SRC = 'https://server.fillout.com/embed/v1/';
  var overlay = null;

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'fo-overlay';
    overlay.innerHTML =
      '<div class="fo-modal" role="dialog" aria-modal="true" aria-label="TCM Wellness Report intake">' +
      '<button class="fo-close" aria-label="Close">×</button>' +
      '<div style="width:100%;height:100%" data-fillout-id="' + FORM_ID + '" data-fillout-embed-type="standard" data-fillout-inherit-parameters></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.fo-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    // Load the official embed script after the container exists; it scans the DOM on load.
    var s = document.createElement('script');
    s.src = EMBED_SRC;
    document.body.appendChild(s);
  }

  function open() {
    if (!overlay) build();
    document.body.classList.add('fo-lock');
    setTimeout(function () { overlay.classList.add('open'); }, 20);
  }

  function close() {
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('fo-lock');
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-fillout-open]');
    if (!t) return;
    e.preventDefault();
    open();
  });
})();
