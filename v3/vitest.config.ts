import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Mirrors WXT's alias so component tests import the way the app does.
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // Outside a Vite dev server, `quasar` resolves to the SSR build, which
      // refuses to install without an ssrContext. @quasar/vite-plugin sets this
      // alias when serving; Vitest needs it set explicitly.
      quasar: 'quasar/dist/quasar.client.js',
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Pure-core tests declare nothing and run in node; component tests opt in
    // with `// @vitest-environment jsdom`.
    environment: 'node',
  },
});
