import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';

// E2E: load the built extension into a real browser and confirm each panel
// surface renders. (Run `npm run build` first; the `test` script does this.)
// Firefox can't be driven this way — its build is covered by
// scripts/check-manifests.mjs and by the manual pass.
const EXT_PATH = resolve('.output/chrome-mv3');

// Both surfaces mount the same app, so both must render it. Note the DevTools
// panel is opened here as a plain tab: this proves its page mounts, not that
// DevTools registers it — that registration is asserted on the manifest by
// scripts/check-manifests.mjs and confirmed by hand.
const SURFACES = [
  { name: 'side panel', page: 'sidepanel.html' },
  { name: 'DevTools panel', page: 'devtools-panel.html' },
];

test('built extension loads and every panel surface renders', async () => {
  const context: BrowserContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--headless=new`, `--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });

  try {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    const extId = new URL(sw.url()).host;
    expect(extId).toMatch(/^[a-z]{32}$/);

    for (const surface of SURFACES) {
      await test.step(surface.name, async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extId}/${surface.page}`);

        await expect(page.getByTestId('pick-toggle')).toBeVisible();
        await expect(page.getByTestId('empty-state')).toBeVisible();
        await expect(page.getByTestId('surface-label')).toBeVisible();
        // Code panel is present (empty model still renders the class skeleton).
        await expect(page.getByTestId('code-output')).toContainText('class GeneratedPage');
        await page.close();
      });
    }
  } finally {
    await context.close();
  }
});
