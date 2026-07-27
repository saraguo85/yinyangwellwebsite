// Fillout intake modal: any element with data-fillout-open opens the intake form in an on-site overlay.
// Uses Fillout's official embed script (renders inside our own modal shell) so we stay on their
// supported embed path instead of iframing forms.fillout.com directly (which is CSP-restricted).
//
// The embed pulls ~80 JS chunks from embed.fillout.com, so anything that waits for the click
// leaves the user staring at an empty modal for many seconds on a cold cache. Two defences:
//   1. Warm up on idle, straight after first paint, so the form is already loaded before any
//      realistic click. Deliberately not on script execution: that would compete with the
//      page's own fonts and images for bandwidth while the visible page is still rendering.
//   2. Show a loading state regardless, so a slow connection reads as "loading" not "broken".
(function () {
  var FORM_ID = '94MTXD2bFeus';
  var EMBED_SRC = 'https://server.fillout.com/embed/v1/';
  var overlay = null;
  var warmed = false;

  function onIdle(fn, timeout) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: timeout || 2000 });
    else setTimeout(fn, 200);
  }

  // Hides the loading state once the embed iframe has finished loading. The embed script
  // injects the iframe asynchronously, so watch for it rather than assuming it is there.
  function trackReady() {
    var modal = overlay.querySelector('.fo-modal');
    function ready() { overlay.classList.add('fo-ready'); }
    var existing = modal.querySelector('iframe');
    if (existing) {
      existing.addEventListener('load', ready);
      return;
    }
    var mo = new MutationObserver(function () {
      var f = modal.querySelector('iframe');
      if (!f) return;
      mo.disconnect();
      f.addEventListener('load', ready);
    });
    mo.observe(modal, { childList: true, subtree: true });
  }

  // Creates the overlay and starts loading the form. Safe to call more than once.
  function warm() {
    if (warmed) return;
    warmed = true;

    overlay = document.createElement('div');
    overlay.className = 'fo-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="fo-modal" role="dialog" aria-modal="true" aria-label="TCM Wellness Report intake">' +
      '<button class="fo-close" aria-label="Close">×</button>' +
      '<div class="fo-loading" aria-live="polite"><span class="fo-spin"></span>Loading your assessment…</div>' +
      '<div class="fo-frame" data-fillout-id="' + FORM_ID + '" data-fillout-embed-type="standard" data-fillout-inherit-parameters></div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Keep the warmed-but-invisible dialog out of the tab order and off screen readers.
    if ('inert' in HTMLElement.prototype) overlay.inert = true;

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.fo-close').addEventListener('click', close);

    trackReady();

    // Load the official embed script after the container exists; it scans the DOM on load.
    var s = document.createElement('script');
    s.src = EMBED_SRC;
    document.body.appendChild(s);
  }

  function open() {
    warm();
    overlay.setAttribute('aria-hidden', 'false');
    if ('inert' in HTMLElement.prototype) overlay.inert = false;
    document.body.classList.add('fo-lock');
    requestAnimationFrame(function () { overlay.classList.add('open'); });
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    if ('inert' in HTMLElement.prototype) overlay.inert = true;
    document.body.classList.remove('fo-lock');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) close();
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-fillout-open]');
    if (!t) return;
    e.preventDefault();
    open();
  });

  // Backstop for the rare case where idle never fires before the user reaches a CTA.
  ['pointerenter', 'touchstart', 'focusin'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      if (e.target.closest && e.target.closest('[data-fillout-open]')) warm();
    }, { passive: true, capture: true });
  });

  // Warm up straight after first paint.
  if (document.readyState === 'complete') onIdle(warm);
  else window.addEventListener('load', function () { onIdle(warm); });
})();
