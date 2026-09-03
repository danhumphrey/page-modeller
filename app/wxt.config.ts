import { defineConfig } from 'wxt';
import vue from '@vitejs/plugin-vue';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';

// Validated stack (Spike #2): drive Vite directly with the Vue + Quasar plugins.
export default defineConfig({
  manifest: {
    name: 'Page Modeller',
    description: 'Pick a DOM element and generate a verified Playwright Page Object Model.',
    permissions: ['activeTab', 'tabs', 'sidePanel'],
    host_permissions: ['<all_urls>'],
  },
  vite: () => ({
    plugins: [vue({ template: { transformAssetUrls } }), quasar({})],
  }),
});
