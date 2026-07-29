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
  //
  // Attaching a 'load' listener is not enough on its own: the iframe can finish loading
  // between being inserted and the MutationObserver callback running, and 'load' does not
  // fire again for a document that is already complete -- the spinner would then turn
  // forever. So check the readyState too, and keep a timeout backstop so a slow or blocked
  // embed still surrenders the spinner instead of looking broken (reported 2026-07-29: a
  // CTA spinning 20+ seconds).
  function trackReady() {
    var modal = overlay.querySelector('.fo-modal');
    var done = false;
    function ready() {
      if (done) return;
      done = true;
      overlay.classList.add('fo-ready');
    }
    function watch(f) {
      f.addEventListener('load', ready);
      // already finished before we got here?
      try {
        if (f.contentDocument && f.contentDocument.readyState === 'complete') ready();
      } catch (e) {
        // cross-origin once the embed navigates -- which itself means it has started
      }
    }
    var existing = modal.querySelector('iframe');
    if (existing) {
      watch(existing);
    } else {
      var mo = new MutationObserver(function () {
        var f = modal.querySelector('iframe');
        if (!f) return;
        mo.disconnect();
        watch(f);
      });
      mo.observe(modal, { childList: true, subtree: true });
    }
    setTimeout(ready, 12000);
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
      '<button class="fo-fresh" type="button">Start fresh</button>' +
      '<div class="fo-loading" aria-live="polite"><span class="fo-spin"></span>Loading your assessment…</div>' +
      '<div class="fo-frame" data-fillout-id="' + FORM_ID + '" data-fillout-embed-type="standard" data-fillout-inherit-parameters></div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Keep the warmed-but-invisible dialog out of the tab order and off screen readers.
    if ('inert' in HTMLElement.prototype) overlay.inert = true;

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.fo-close').addEventListener('click', close);
    overlay.querySelector('.fo-fresh').addEventListener('click', freshStart);

    trackReady();

    // Load the official embed script after the container exists; it scans the DOM on load.
    var s = document.createElement('script');
    s.src = EMBED_SRC;
    document.body.appendChild(s);
  }

  // Fillout keeps one saved session per form PER QUERY STRING, on its own origin --
  // verified 2026-07-29 by reading __fillout_live_session_metadata_… inside the embed,
  // which held separate entries under "" and "?fresh=1785140394635". Our page cannot
  // clear that storage (cross-origin), but giving the embed a query string it has never
  // seen starts a genuinely blank session. The value must be minted at click time: a
  // hardcoded one would itself become a saved session and stick after its first use.
  function freshStart() {
    var f = overlay.querySelector('iframe');
    if (!f) return;
    if (!window.confirm('Start a fresh form?\n\nAnything already filled in on this device will be cleared. Use this when you are filling it in for someone else.')) return;
    overlay.classList.remove('fo-ready');
    f.src = f.src.split(/[?&]fresh=/)[0] + '&fresh=' + Date.now();
    trackReady();
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
