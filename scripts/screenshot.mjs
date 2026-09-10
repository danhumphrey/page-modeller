// Renders every panel surface from the built Chrome extension. A quick visual
// check between code changes — not a substitute for the manual pass.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const SURFACES = [
  { page: 'sidepanel.html', out: 'sidepanel-render.png', width: 420, height: 640 },
  { page: 'devtools-panel.html', out: 'devtools-panel-render.png', width: 900, height: 420 },
];

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--headless=new`, `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;

for (const s of SURFACES) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: s.width, height: s.height });
  await page.goto(`chrome-extension://${id}/${s.page}`);
  await page.waitForSelector('[data-testid="btn-scan"]');
  await page.screenshot({ path: s.out });
  await page.close();
  console.log(`wrote ${s.out}`);
}
await ctx.close();
