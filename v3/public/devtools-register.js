// Registers the DevTools panel.
//
// Deliberately a plain classic script copied out of public/, NOT a bundled
// module entrypoint. WXT emits module entrypoints as `<script type="module">`,
// which is deferred — and in dev it points at the Vite dev server over http, so
// panels.create ran only after a network round-trip and not at all if that
// fetch failed (the dev server does not always land on the same port). A panel
// registered late or never is a panel the user does not see. This runs
// synchronously while devtools.html parses, with no network dependency.
(function () {
  var api = globalThis.browser || globalThis.chrome;
  api.devtools.panels.create('Page Modeller', 'icon/32.png', 'devtools-panel.html', function () {
    // Silence here means success; surface the failure rather than showing no panel.
    var err = api.runtime && api.runtime.lastError;
    if (err) console.error('[Page Modeller] DevTools panel registration failed:', err.message);
  });
})();
