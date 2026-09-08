import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

// Capture E2E: drives the content script the way the panel does, from the
// service worker. Playwright cannot open a real side panel, so this is the only
// automated cover the inspector overlay gets — the panel→row half stays a
// manual check.
//
// Fixtures are served over http because content scripts do not run on file://.
const EXT_PATH = resolve('.output/chrome-mv3');
const PORT = 5211;

let server: ChildProcess;
let context: BrowserContext;

test.beforeAll(async () => {
  server = spawn('node', ['scripts/serve-fixtures.mjs'], { env: { ...process.env, FIXTURES_PORT: String(PORT) }, stdio: 'ignore' });
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });
});

test.afterAll(async () => {
  await context?.close();
  server?.kill();
});

/**
 * The panel's runtime.onMessage, stood up in the service worker. The worker
 * outlives each test, so the listener is installed once — registering it per
 * test records every message as many times as there are listeners.
 */
async function collectMessages(sw: { evaluate: (fn: never, arg?: unknown) => Promise<unknown> }) {
  await (sw as unknown as { evaluate: (f: () => void) => Promise<void> }).evaluate(() => {
    const g = globalThis as unknown as { __picks: unknown[]; __collecting?: boolean };
    g.__picks = [];
    if (g.__collecting) return;
    g.__collecting = true;
    chrome.runtime.onMessage.addListener((m) => g.__picks.push(m));
  });
}

test('picking is one-shot and reports a named element', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/login.html`);

  const tabId: number = await sw.evaluate(
    async (url) => (await chrome.tabs.query({ url }))[0].id!,
    `http://localhost:${PORT}/login.html`
  );

  await collectMessages(sw as never);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add' }), tabId);

  // Hovering draws the overlay; clicking picks.
  await page.getByRole('button', { name: 'Sign in' }).hover();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: { type: string }[] }).__picks)).length)
    .toBe(1);

  const picks = await sw.evaluate(() => (globalThis as unknown as { __picks: Record<string, unknown>[] }).__picks);
  expect(picks[0].type).toBe('ELEMENT_PICKED');

  const result = picks[0].result as { role: string; suggestedName: string; preferredIndex: number };
  expect(result.role).toBe('button');
  expect(result.suggestedName).toBe('SignIn');
  expect(result.preferredIndex, 'engine found a unique locator').toBeGreaterThanOrEqual(0);

  // One-shot (SPEC §4): a second click must NOT produce another pick, and the
  // overlay must be gone.
  await page.getByRole('link', { name: 'Home' }).click();
  await page.waitForTimeout(500);
  const after = await sw.evaluate(() => (globalThis as unknown as { __picks: unknown[] }).__picks.length);
  expect(after, 'picking stopped itself after one element').toBe(1);
});

test('highlighting reports its count as a message, and Close clears it', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/login.html`);
  const tabId: number = await sw.evaluate(
    async (url) => (await chrome.tabs.query({ url }))[0].id!,
    `http://localhost:${PORT}/login.html`
  );

  await collectMessages(sw as never);

  const marks = page.locator('[data-page-modeller="highlight"]');

  // The count comes back as HIGHLIGHT_RESULT, not as a reply. sendResponse is
  // not portable — Chrome wants `return true`, Firefox's native browser.* wants
  // a returned Promise, and doing both left the caller's promise unsettled on
  // Firefox, reported as "can't reach this page".
  await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: 'HIGHLIGHT', candidate: { kind: 'role', role: 'link', name: 'Home', exact: true } }),
    tabId
  );
  await expect(marks).toHaveCount(1);
  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: { type: string; count?: number }[] }).__picks))
      .filter((m) => m.type === 'HIGHLIGHT_RESULT')
      .map((m) => m.count))
    .toEqual([1]);

  // A locator matching several elements highlights all of them.
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'HIGHLIGHT', candidate: { kind: 'css', value: 'a' } }), tabId);
  await expect(marks).toHaveCount(3);

  // Close dismisses the highlight, not just the message.
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'CLEAR_HIGHLIGHT' }), tabId);
  await expect(marks).toHaveCount(0);
});
