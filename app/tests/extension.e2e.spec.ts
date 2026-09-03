import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';

// E2E: load the built extension into a real browser and confirm the side panel
// renders. (Run `npm run build` first; the `test` script does this.)
const EXT_PATH = resolve('.output/chrome-mv3');

test('built extension loads and the side panel renders', async () => {
  const context: BrowserContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--headless=new`, `--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });

  try {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    const extId = new URL(sw.url()).host;
    expect(extId).toMatch(/^[a-z]{32}$/);

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/sidepanel.html`);

    await expect(page.getByTestId('pick-toggle')).toBeVisible();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    // Code panel is present (empty model still renders the class skeleton).
    await expect(page.getByTestId('code-output')).toContainText('class GeneratedPage');
  } finally {
    await context.close();
  }
});
