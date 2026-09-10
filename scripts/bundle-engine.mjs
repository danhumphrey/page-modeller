import { build } from 'esbuild';

// Bundle the locator engine into a classic IIFE the fidelity test injects into
// pages under test (sets window.__spike).
await build({
  entryPoints: ['src/engine/inject-global.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  outfile: '.test-dist/engine.global.js',
  logLevel: 'info',
});
