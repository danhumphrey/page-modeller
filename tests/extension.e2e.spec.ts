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

test('the options page renders every setting', async () => {
  const context: BrowserContext = await chromium.launchPersistentContext('', {
    headless: false,
    // A DARK browser, so that "auto" genuinely means dark. Under the default
    // light scheme the theme assertion below passes whether or not Quasar was
    // switched, which makes it worthless.
    colorScheme: 'dark',
    args: [`--headless=new`, `--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });

  try {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${new URL(sw.url()).host}/options.html`);

    // A setting nobody can reach is not a setting (SPEC §14).
    for (const key of ['showTooltips', 'appendTypeToName', 'modelHiddenElements', 'clickTableRowsToViewMatchedElements']) {
      await expect(page.getByTestId(`option-${key}`)).toBeVisible();
    }
    await expect(page.getByTestId('option-theme')).toBeVisible();

    // Choosing Light must move BOTH our tokens and Quasar's dark mode. Setting
    // only the tokens left dark text on Quasar's dark body.
    await page.getByTestId('option-theme').click();
    await page.getByRole('option', { name: 'Light' }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-pm-theme')))
      .toBe('light');
    await expect
      .poll(() => page.evaluate(() => document.body.classList.contains('body--dark')))
      .toBe(false);

    // Toggling writes through to sync storage, which is what the panel reads.
    await page.getByTestId('option-appendTypeToName').click();
    await expect
      .poll(async () =>
        page.evaluate(async () => ((await chrome.storage.sync.get('options')) as { options?: { appendTypeToName?: boolean } }).options?.appendTypeToName)
      )
      .toBe(true);
  } finally {
    await context.close();
  }
});

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

        // Toolbar and empty state (SPEC §3, §6).
        await expect(page.getByTestId('btn-scan')).toBeVisible();
        await expect(page.getByTestId('btn-add')).toBeVisible();
        await expect(page.getByTestId('framework-selector')).toContainText('Playwright');
        await expect(page.getByTestId('empty-state')).toBeVisible();

        // Guidance is a dialog now, reachable whenever it is wanted rather
        // than a row that shifts the table under the pointer.
        await expect(page.getByTestId('btn-help')).toBeEnabled();
        await page.getByTestId('btn-help').click();
        await expect(page.getByTestId('help-ok')).toBeVisible();
        // Asked for, so not offered as something to be rid of.
        await expect(page.getByTestId('help-dont-show')).toHaveCount(0);
        await page.getByTestId('help-ok').click();
        await expect(page.getByTestId('help-ok')).toHaveCount(0);

        // Enablement with no model: scan and add live, the rest disabled.
        await expect(page.getByTestId('btn-delete-model')).toBeDisabled();
        await expect(page.getByTestId('btn-generate')).toBeDisabled();
        await expect(page.getByTestId('btn-scan')).toBeEnabled();
        await expect(page.getByTestId('btn-add')).toBeEnabled();

        // The framework selector offers every target and locks after a model
        // exists — it must at least open while there is none.
        await page.getByTestId('framework-selector').click();
        await expect(page.getByText('Selenium WebDriver Java')).toBeVisible();
        await page.keyboard.press('Escape');

        await page.close();
      });
    }
  } finally {
    await context.close();
  }
});
