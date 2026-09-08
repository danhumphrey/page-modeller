import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import vue from '@vitejs/plugin-vue';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';

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

  manifest: ({ browser }) => ({
    name: 'Page Modeller',
    description: 'Pick a DOM element and generate a verified Playwright Page Object Model.',
    // `sidePanel` is Chromium-only and is rejected by Firefox; WXT adds it to
    // the Chrome build itself when it sees the sidepanel entrypoint.
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
          id: 'todo-amo-id@page-modeller.invalid',
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
    keepProfileChanges: true,
    chromiumProfile: devProfile('chrome-profile'),
    firefoxProfile: devProfile('firefox-profile'),
  },

  vite: () => ({
    plugins: [vue({ template: { transformAssetUrls } }), quasar({})],
  }),
});
