// Asserts both builds emit the surfaces we expect. Cheap guard on the one thing
// that silently differs per browser — Playwright can't load a Firefox extension,
// so this is the only automated check the Firefox build gets.
import { readFile } from 'node:fs/promises';

const EXPECT = {
  'chrome-mv3': {
    'manifest_version': (m) => m.manifest_version === 3,
    'action (toolbar button exists)': (m) => m.action != null,
    'contextMenus permission': (m) => m.permissions?.includes('contextMenus'),
    'storage permission': (m) => m.permissions?.includes('storage'),
    'options_ui opens in a tab': (m) => m.options_ui?.open_in_tab === true,
    'icons': (m) => m.icons?.['128'] != null,
    'side_panel.default_path': (m) => m.side_panel?.default_path === 'sidepanel.html',
    'sidePanel permission': (m) => m.permissions?.includes('sidePanel'),
    'devtools_page': (m) => m.devtools_page === 'devtools.html',
    'background.service_worker': (m) => typeof m.background?.service_worker === 'string',
    'no gecko settings': (m) => m.browser_specific_settings == null,
    // sidePanel is Chrome 114+; storage.session is 102+.
    'minimum_chrome_version covers sidePanel': (m) => Number(m.minimum_chrome_version) >= 114,
  },
  'firefox-mv3': {
    'manifest_version': (m) => m.manifest_version === 3,
    'action (toolbar button exists)': (m) => m.action != null,
    'contextMenus permission': (m) => m.permissions?.includes('contextMenus'),
    'storage permission': (m) => m.permissions?.includes('storage'),
    'options_ui opens in a tab': (m) => m.options_ui?.open_in_tab === true,
    'icons': (m) => m.icons?.['128'] != null,
    'sidebar_action.default_panel': (m) => m.sidebar_action?.default_panel === 'sidepanel.html',
    'no sidePanel permission': (m) => !m.permissions?.includes('sidePanel'),
    'devtools_page': (m) => m.devtools_page === 'devtools.html',
    'background.scripts': (m) => Array.isArray(m.background?.scripts),
    'gecko.id': (m) => typeof m.browser_specific_settings?.gecko?.id === 'string',
    // storage.session is Firefox 115+, which is the highest floor here.
    'strict_min_version covers storage.session': (m) =>
      parseFloat(m.browser_specific_settings?.gecko?.strict_min_version) >= 115,
  },
};

let failed = 0;
const fail = (dir, name) => { console.error(`✗ ${dir}: ${name}`); failed++; };

for (const [dir, checks] of Object.entries(EXPECT)) {
  const manifest = JSON.parse(await readFile(`.output/${dir}/manifest.json`, 'utf8'));
  for (const [name, ok] of Object.entries(checks)) if (!ok(manifest)) fail(dir, name);

  // The DevTools panel must be registered by a parser-blocking classic script.
  // As a `type="module"` entrypoint the call is deferred and, in dev, fetched
  // from the Vite dev server — which made the panel appear only sometimes.
  const html = await readFile(`.output/${dir}/devtools.html`, 'utf8');
  const tag = html.match(/<script[^>]*devtools-register\.js[^>]*>/)?.[0];
  if (!tag) fail(dir, 'devtools.html loads devtools-register.js');
  else if (/type=["']?module/.test(tag)) fail(dir, 'devtools-register.js must NOT be a module (defers panel registration)');
  await readFile(`.output/${dir}/devtools-register.js`, 'utf8').catch(() => fail(dir, 'devtools-register.js emitted'));
}

if (failed) process.exit(1);
console.log('✓ manifests + devtools registration: chrome-mv3 + firefox-mv3 as expected');
