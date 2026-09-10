import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import vue from '@vitejs/plugin-vue';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';

/**
 * Chrome *stable*, not whatever is newest.
 *
 * chrome-launcher picks the most recent installation it finds, which on a
 * machine with Canary installed means testing against Canary — and Canary will
 * happily hide a version problem that the declared floor
 * (`minimum_chrome_version`) exists to catch.
 *
 * Returns undefined when stable is not where it is expected, so web-ext falls
 * back to its own search rather than failing to launch. `CHROME_PATH` wins, as
 * chrome-launcher itself honours it.
 */
function chromeStable(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates: Record<string, string[]> = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ],
  };
  return (candidates[process.platform] ?? []).find((path) => existsSync(path));
}

function devProfile(name: string): string {
  const path = resolve('.wxt', name);
  mkdirSync(path, { recursive: true });
  return path;
}

// Validated stack (Spike #2): drive Vite directly with the Vue + Quasar plugins.
export default defineConfig({
  // MV3 on both browsers. v2.5.1 already ships MV3 to AMO (it only swaps
  // background.service_worker for background.scripts), so MV2 here would be a
  // downgrade on an in-place update. WXT makes the background swap for us.
  manifestVersion: 3,

  /**
   * AMO reviews the source of a bundled add-on, so this zip is read by a
   * person. Without these it carried 17 MB of C# build output — three
   * `selenium-manager` binaries the compile check pulls in — which is both
   * noise and a reason to ask questions.
   */
  zip: {
    excludeSources: ['tests/compile/**', '.test-venv/**', '.test-dist/**', 'test-results/**', '*-render.png'],
  },


  manifest: ({ browser }) => ({
    // The frameworks people search the stores for. v2.5.1 was "Page Modeller
    // (Selenium, Robot Framework etc)"; Robot Framework and Protractor are
    // gone and Playwright leads now.
    name: 'Page Modeller (Playwright, Selenium, Puppeteer etc.)',
    // Shown under the icon in the Chrome store, where the full name will not
    // fit. Carried over from v2.5.1 unchanged.
    short_name: 'PageModeller',
    description: 'Pick a DOM element and generate a verified Playwright Page Object Model.',
    // `sidePanel` is Chromium-only and is rejected by Firefox; WXT adds it to
    // the Chrome build itself when it sees the sidepanel entrypoint.
    // The side panel API is Chrome 114+, and it is the highest floor anything
    // here has — without this the store would offer the extension to browsers
    // where the panel silently does not exist. Firefox's floor is declared as
    // gecko.strict_min_version below.
    minimum_chrome_version: '114',
    // `storage` covers storage.session, where the per-tab models live (SPEC §5)
    // — the service worker is terminated after 30s idle and cannot hold them —
    // and storage.sync for settings (SPEC §14).
    permissions: ['activeTab', 'tabs', 'storage', 'contextMenus'],
    // No popup — the click is handled in the background so it can open the
    // side panel (Chrome) or toggle the sidebar (Firefox). Without an `action`
    // key there is no toolbar button at all.
    action: { default_title: 'Page Modeller' },
    host_permissions: ['<all_urls>'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // TODO(release): replace with the real AMO id before any upload — a
          // mismatch creates a second listing instead of updating the existing
          // one (NFR-6). v2.5.1's manifest never carried an id, so AMO assigned
          // it; read it off the Developer Hub.
          // The id AMO assigned to the existing listing. v2.5.1 declared none,
          // so this is the only thing that makes an upload an UPDATE rather
          // than a second add-on. Found via the public AMO search API.
          id: '{1e34b9b3-8f45-415e-9586-c7d5de0d0aff}',
          strict_min_version: '115.0',
          // Nothing leaves the browser — locators are computed locally and the
          // extension makes no network requests.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),

  // web-ext launches a throwaway profile by default, so every `npm run dev`
  // started with empty storage.sync — settings never survived a restart, and
  // neither did being logged in to whatever site you were modelling. These live
  // under .wxt/, which is gitignored.
  //
  // Created here because chrome-launcher writes its log INTO the profile
  // directory without creating it first, and dies with ENOENT if it is missing.
  webExt: {
    binaries: { chrome: chromeStable() },
    keepProfileChanges: true,
    chromiumProfile: devProfile('chrome-profile'),
    firefoxProfile: devProfile('firefox-profile'),
  },

  vite: () => ({
    plugins: [vue({ template: { transformAssetUrls } }), quasar({})],
  }),
});
