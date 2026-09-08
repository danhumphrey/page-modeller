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
 * Open a fixture and return its tab id. Each test gets a distinct URL: pages
 * accumulate across tests in one persistent context, and tabs.query({url})
 * would otherwise return an earlier test's tab.
 */
async function openFixture(sw: { evaluate: (fn: never, arg?: unknown) => Promise<unknown> }, caseName: string) {
  const url = `http://localhost:${PORT}/login.html?case=${caseName}`;
  const page = await context.newPage();
  await page.goto(url);
  const tabId = (await (sw as unknown as { evaluate: (f: (u: string) => Promise<number>, a: string) => Promise<number> }).evaluate(
    async (u) => (await chrome.tabs.query({ url: u }))[0].id!,
    url
  )) as number;
  return { page, tabId };
}

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

  const { page, tabId } = await openFixture(sw as never, 'oneshot');
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

  const { page, tabId } = await openFixture(sw as never, 'highlight');
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

test('the background relays panel messages, and reports an unreachable tab', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  const { page, tabId } = await openFixture(sw as never, 'relay');
  await collectMessages(sw as never);

  // The panel never calls tabs.sendMessage — a DevTools page is not granted
  // that API — so everything goes through the background. Drive the relay from
  // a real extension page, which is what the panel is.
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: 'RELAY_TO_TAB',
        tabId: id,
        message: { type: 'HIGHLIGHT', candidate: { kind: 'role', role: 'link', name: 'Home', exact: true } },
      }),
    tabId
  );
  await expect(page.locator('[data-page-modeller="highlight"]')).toHaveCount(1);

  // A tab that does not exist. An extension page would not do: tabs.sendMessage
  // reaches extension pages hosted in a tab, so the panel's own listener
  // answers and nothing rejects. The failure has to come back as a message,
  // since the panel cannot see the background's rejection.
  const missingTabId = 987654321;
  // Collected in the panel page, not the service worker: runtime.sendMessage
  // does not fire the sender's own listener, so the background cannot observe
  // the failure it reports. The panel is the intended audience anyway.
  await panel.evaluate(() => {
    (window as unknown as { __msgs: { type: string; tabId?: number }[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });

  await panel.evaluate(
    (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'STOP_PICKING' } }),
    missingTabId
  );
  await expect
    .poll(async () =>
      (await panel.evaluate(() => (window as unknown as { __msgs: { type: string; tabId?: number }[] }).__msgs))
        .filter((m) => m.type === 'TAB_UNREACHABLE')
        .map((m) => m.tabId)
    )
    .toEqual([missingTabId]);
});

test('a pick reaches a panel page stamped with its tab', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  const { page, tabId } = await openFixture(sw as never, 'frompanel');

  // A real extension page, which is what a panel is. The panel cannot filter on
  // sender.tab — Firefox does not populate it for a DevTools page — so the
  // background re-broadcasts content traffic as FROM_TAB with the tab stamped
  // on it, and this is what proves that arrives.
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate(() => {
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });

  await panel.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: 'RELAY_TO_TAB',
        tabId: id,
        message: { type: 'START_PICKING', mode: 'add' },
      }),
    tabId
  );

  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect
    .poll(async () =>
      (
        await panel.evaluate(
          () => (window as unknown as { __msgs: { type: string; tabId?: number; message?: { type: string } }[] }).__msgs
        )
      )
        .filter((m) => m.type === 'FROM_TAB' && m.message?.type === 'ELEMENT_PICKED')
        .map((m) => m.tabId)
    )
    .toEqual([tabId]);
});
