#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const {
  install,
  resolveBuildId,
  computeExecutablePath,
  detectBrowserPlatform,
  Browser,
} = require('@puppeteer/browsers');

// Regular Google Chrome 127+ silently refuses to load unpacked extensions
// without developer mode being enabled in the UI. Chrome for Testing is
// designed for automation and accepts --load-extension out of the box.
async function ensureChromeForTesting() {
  const cacheDir = path.resolve(__dirname, '..', '.chrome-for-testing');
  const platform = detectBrowserPlatform();
  const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');

  await install({
    cacheDir,
    browser: Browser.CHROME,
    buildId,
  });

  return computeExecutablePath({
    cacheDir,
    browser: Browser.CHROME,
    buildId,
    platform,
  });
}

async function main() {
  const chromePath = await ensureChromeForTesting();
  const extPath = path.resolve(__dirname, '..', 'build');
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-modeller-'));

  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--password-store=basic',
    '--use-mock-keychain',
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
    '--auto-open-devtools-for-tabs',
    'https://github.com/danhumphrey/page-modeller',
  ];

  const ps = spawn(chromePath, args, { stdio: 'inherit' });

  const cleanup = () => {
    try { ps.kill(); } catch (_) { /* ignore */ }
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  ps.on('exit', () => process.exit(0));
}

main().catch((err) => {
  console.error('launch-chrome failed:', err);
  process.exit(1);
});
