import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--headless=new`, `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.setViewportSize({ width: 420, height: 640 });
await page.goto(`chrome-extension://${id}/sidepanel.html`);
await page.waitForSelector('[data-testid="pick-toggle"]');
await page.screenshot({ path: 'sidepanel-render.png' });
await ctx.close();
console.log('wrote sidepanel-render.png');
