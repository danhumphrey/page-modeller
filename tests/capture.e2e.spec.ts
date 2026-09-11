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
async function openFixture(
  sw: { evaluate: (fn: never, arg?: unknown) => Promise<unknown> },
  caseName: string,
  file = 'login.html'
) {
  const url = `http://localhost:${PORT}/${file}?case=${caseName}`;
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
    // OVERLAY_SHOWN is plumbing — a frame telling the background it drew, so
    // the other frames can clear. The panel ignores it and so does this.
    chrome.runtime.onMessage.addListener((m) => {
      if ((m as { type?: string })?.type !== 'OVERLAY_SHOWN') g.__picks.push(m);
    });
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

test('one-shot means one pick per TAB, not one per frame', async () => {
  // The content script runs in every frame, so START_PICKING arms every frame.
  // Only the clicked frame used to stop itself, leaving the rest live: one pick
  // in a framed page recorded three elements as the user carried on clicking.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frames-oneshot', 'frames.html');
  await page.waitForLoadState('networkidle');
  expect(page.frames().length, 'the fixture really is framed').toBeGreaterThan(3);
  await collectMessages(sw as never);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add' }), tabId);

  // Hover the top frame first, so it draws an overlay of its own, then pick
  // inside a child frame.
  await page.getByRole('heading', { name: 'Frames', exact: true }).hover();
  const child = page.frameLocator('#same-frame');
  await child.getByRole('button', { name: 'Submit', exact: true }).hover();
  await child.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: unknown[] }).__picks)).length)
    .toBe(1);

  // Clicking on in other frames must add nothing: they were disarmed too.
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.frameLocator('#same-frame').frameLocator('#deep-frame').getByRole('button', { name: 'Submit', exact: true }).click();
  await page.waitForTimeout(500);
  const after = await sw.evaluate(() => (globalThis as unknown as { __picks: unknown[] }).__picks.length);
  expect(after, 'every frame disarmed after the first pick').toBe(1);

  // And no frame is left wearing an overlay.
  for (const frame of page.frames()) {
    const left = await frame.locator('[data-page-modeller="label"]').count().catch(() => 0);
    expect(left, `overlay left behind in ${frame.url()}`).toBe(0);
  }
});

test('only the frame under the pointer wears an overlay', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frames-overlay', 'frames.html');
  await page.waitForLoadState('networkidle');
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add' }), tabId);

  const labels = async () => {
    let n = 0;
    for (const frame of page.frames()) n += await frame.locator('[data-page-modeller="label"]').count().catch(() => 0);
    return n;
  };

  await page.getByRole('heading', { name: 'Frames', exact: true }).hover();
  await expect.poll(labels).toBe(1);

  // Moving into a child frame must hand the overlay over, not add a second.
  await page.frameLocator('#same-frame').getByRole('heading', { name: 'Payment' }).hover();
  await expect.poll(labels, { message: 'the parent kept its overlay' }).toBe(1);

  // And two deep.
  await page.frameLocator('#same-frame').frameLocator('#deep-frame').getByRole('button', { name: 'Submit', exact: true }).hover();
  await expect.poll(labels, { message: 'an ancestor frame kept its overlay' }).toBe(1);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'STOP_PICKING' }), tabId);
  await expect.poll(labels).toBe(0);
});

test('a pick inside a frame carries the chain, and the chain resolves (SPEC §16)', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frame-path', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  // Two frames deep, and its accessible name is shared with eight other
  // buttons across the tree — so the path is the only thing that can separate
  // them, which is what makes this worth asserting.
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add' }), tabId);
  const deep = page.frameLocator('#same-frame').frameLocator('#deep-frame');
  await deep.getByRole('button', { name: 'Submit', exact: true }).hover();
  await deep.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: unknown[] }).__picks)).length)
    .toBe(1);

  const picks = await sw.evaluate(() => (globalThis as unknown as { __picks: Record<string, unknown>[] }).__picks);
  const result = picks[0].result as { framePath: { frame: { value: string }; opaque?: boolean }[] };

  expect(result.framePath.map((s) => s.frame.value), 'outermost first').toEqual(['#same-frame', '#deep-frame']);
  expect(result.framePath.some((s) => s.opaque), 'same-origin, so the chain is complete').toBe(false);

  // The whole point: rebuild the locator the generator would emit and check
  // Playwright lands on the element that was clicked, not one of the eight
  // others with the same name.
  let chain = page.frameLocator(result.framePath[0].frame.value);
  for (const step of result.framePath.slice(1)) chain = chain.frameLocator(step.frame.value);
  const resolved = chain.getByRole('button', { name: 'Submit', exact: true });
  await expect(resolved).toHaveCount(1);
  await expect(resolved).toHaveAttribute('data-spike', 'deep-submit');
});

test('a pick in the main frame still has no chain', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frame-path-main', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add' }), tabId);
  await page.getByRole('button', { name: 'Submit', exact: true }).hover();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: unknown[] }).__picks)).length)
    .toBe(1);
  const picks = await sw.evaluate(() => (globalThis as unknown as { __picks: Record<string, unknown>[] }).__picks);
  expect((picks[0].result as { framePath: unknown[] }).framePath).toEqual([]);
});

test('a srcdoc frame can be picked at all, and gets a complete chain', async () => {
  // `about:srcdoc` is not matched by `<all_urls>`, so the content script never
  // ran in one and clicking inside it did nothing whatsoever.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'srcdoc', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add', nonce: 'n' }), tabId);
  const btn = page.frameLocator('#srcdoc-frame').getByRole('button', { name: 'Submit', exact: true });
  await btn.hover();
  await btn.click();

  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: { type: string }[] }).__picks))
      .filter((m) => m.type === 'ELEMENT_PICKED').length)
    .toBe(1);

  const picks = await sw.evaluate(() => (globalThis as unknown as { __picks: Record<string, unknown>[] }).__picks);
  const result = (picks.find((m) => m.type === 'ELEMENT_PICKED') as {
    result: { framePath: { frame: { value: string }; opaque?: boolean }[] };
  }).result;

  // srcdoc is same-origin with its parent, so the chain is complete — unlike a
  // sandboxed frame, whose origin is opaque by construction.
  expect(result.framePath.some((s) => s.opaque)).toBe(false);
  expect(result.framePath).toHaveLength(1);
  expect(result.framePath[0].frame.value).toContain('Srcdoc');
});

test('a cross-origin frame gets a real chain, not an opaque one (SPEC §16)', async () => {
  // `window.frameElement` is unreadable across an origin, so a frame cannot see
  // what embeds it — every cross-origin and sandboxed element used to come out
  // marked opaque. The parent CAN see it, so the path is pushed down instead.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frame-path-cross', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add', nonce: 'n' }), tabId);
  const cross = page.frameLocator('#cross-frame');
  await cross.getByRole('button', { name: 'Submit', exact: true }).hover();
  await cross.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: unknown[] }).__picks)).length)
    .toBe(1);
  const picks = await sw.evaluate(() => (globalThis as unknown as { __picks: Record<string, unknown>[] }).__picks);
  const result = picks[0].result as { framePath: { frame: { value: string }; opaque?: boolean }[] };

  expect(result.framePath.some((s) => s.opaque), 'the chain is complete').toBe(false);
  expect(result.framePath.map((s) => s.frame.value)).toEqual(['#cross-frame']);

  // And it resolves: Playwright does not care about origins.
  const resolved = page.frameLocator('#cross-frame').getByRole('button', { name: 'Submit', exact: true });
  await expect(resolved).toHaveCount(1);
  await expect(resolved).toHaveAttribute('data-spike', 'child-submit');
});

test('a sandboxed frame gets a real chain too', async () => {
  // An opaque origin by construction, and the case that produced
  // `frameLocator(':root')` — the opaque marker leaking out as a selector.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frame-path-sandbox', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add', nonce: 'n' }), tabId);
  const box = page.frameLocator('#sandboxed-frame').getByRole('button', { name: 'Submit', exact: true });
  await box.hover();
  await box.click();

  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: unknown[] }).__picks)).length)
    .toBe(1);
  const picks = await sw.evaluate(() => (globalThis as unknown as { __picks: Record<string, unknown>[] }).__picks);
  const result = picks[0].result as { framePath: { frame: { value: string }; opaque?: boolean }[] };

  expect(result.framePath.some((s) => s.opaque)).toBe(false);
  expect(result.framePath.map((s) => s.frame.value)).toEqual(['#sandboxed-frame']);
  // The marker must never reach output as if it were a selector.
  expect(JSON.stringify(result.framePath)).not.toContain(':root');
});

test('an unreachable tab does not close guidance the user asked for', async () => {
  // First-use guidance is withdrawn when the page turns out to be unreachable —
  // teaching someone to scan a page that cannot be scanned is noise stacked on
  // an error. Guidance opened from the toolbar is a different thing: it was
  // asked for, and an unrelated failure is no reason to take it away.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await panel.getByTestId('btn-help').click();
  await expect(panel.getByTestId('help-ok')).toBeVisible();

  // The message the panel would get if its page could not be reached. Sent
  // from the service worker, not the panel: runtime.sendMessage never delivers
  // to its own sender. Addressed to the tab the panel is watching, since panels
  // ignore anything naming a different one.
  const watched = await panel.evaluate(
    async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
  );
  await sw.evaluate((id) => chrome.runtime.sendMessage({ type: 'TAB_UNREACHABLE', tabId: id }), watched);
  await expect(panel.getByText("can’t reach this page")).toBeVisible();
  await expect(panel.getByTestId('help-ok'), 'still open — it was asked for').toBeVisible();

  await panel.close();
});

test('holding the modifier keeps Add armed for the next click (SPEC §4)', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'multi-add');
  await collectMessages(sw as never);
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add', nonce: 'n' }), tabId);

  const picks = async () =>
    (await sw.evaluate(() => (globalThis as unknown as { __picks: { type: string }[] }).__picks)).filter(
      (m) => m.type === 'ELEMENT_PICKED'
    );

  // Two picks in a row, modifier held: without it the first would disarm the
  // tab and the second click would do nothing.
  const email = page.getByLabel('Email address');
  await email.hover();
  await email.click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(async () => (await picks()).length).toBe(1);

  const password = page.getByLabel('Password');
  await password.hover();
  await password.click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(async () => (await picks()).length).toBe(2);

  // Let go for the last one and it behaves as it always did.
  const remember = page.getByRole('checkbox');
  await remember.hover();
  await remember.click();
  await expect.poll(async () => (await picks()).length).toBe(3);
  // Releasing it restores one-shot: a further click adds nothing. (The panel
  // learns this through a FROM_TAB broadcast, which the service worker cannot
  // observe — runtime.sendMessage does not deliver to its own sender — so the
  // proof is behavioural.)
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(400);
  expect((await picks()).length, 'one-shot again once released').toBe(3);
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

  // A locator matching several elements highlights all of them. Scoped to the
  // fixture's own markup: a bare `a` also catches the fixture navigation, and
  // the count would then move whenever a fixture gains a link.
  await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: 'HIGHLIGHT', candidate: { kind: 'css', value: 'header a' } }),
    tabId
  );
  await expect(marks).toHaveCount(2);

  // Close dismisses the highlight, not just the message.
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'CLEAR_HIGHLIGHT' }), tabId);
  await expect(marks).toHaveCount(0);
});

test('the eye finds a framed element, and only its own frame answers (SPEC §16)', async () => {
  // Before this, only the top frame answered a HIGHLIGHT, so anything inside a
  // frame reported "0 elements match that locator" while its locator was fine.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frame-eye', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  const results = async () =>
    (await sw.evaluate(
      () => (globalThis as unknown as { __picks: { type: string; count?: number }[] }).__picks
    )).filter((m) => m.type === 'HIGHLIGHT_RESULT');

  // Two frames deep. `#deep-cvv` exists only there.
  await sw.evaluate(
    (id) =>
      chrome.tabs.sendMessage(id, {
        type: 'HIGHLIGHT',
        candidate: { kind: 'css', value: '#deep-cvv' },
        framePath: [{ frame: { kind: 'css', value: '#same-frame' } }, { frame: { kind: 'css', value: '#deep-frame' } }],
      }),
    tabId
  );
  await expect.poll(async () => (await results()).length, { message: 'exactly one frame answers' }).toBe(1);
  expect((await results())[0].count).toBe(1);

  // The same locator with no path is a main-frame question, and the main frame
  // has no #deep-cvv — 0 is the right answer, from one frame only.
  await sw.evaluate(() => ((globalThis as unknown as { __picks: unknown[] }).__picks = []));
  await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: 'HIGHLIGHT', candidate: { kind: 'css', value: '#deep-cvv' } }),
    tabId
  );
  await expect.poll(async () => (await results()).length).toBe(1);
  expect((await results())[0].count).toBe(0);

  // And a main-frame element still works, which is the regression to fear.
  await sw.evaluate(() => ((globalThis as unknown as { __picks: unknown[] }).__picks = []));
  await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: 'HIGHLIGHT', candidate: { kind: 'css', value: '[data-spike=\"top-heading\"]' }, framePath: [] }),
    tabId
  );
  await expect.poll(async () => (await results()).length).toBe(1);
  expect((await results())[0].count).toBe(1);
});

test('scanning a frame scans inside it, with the chain on every element (SPEC §16)', async () => {
  // An <iframe> has no descendants in its parent's document, so scanning one
  // used to return nothing at all.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'frame-scan', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'scan', nonce: 'test-nonce' }),
    tabId
  );

  // The frame element itself has to be the target, which means hitting its
  // BORDER: a click inside the box is routed to the child document, where the
  // child's own picker handles it. Playwright's `position` is relative to the
  // PADDING box, so it can never land there — raw coordinates can.
  const box = (await page.locator('#same-frame').boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + 1);
  await page.mouse.down();
  await page.mouse.up();

  // Each frame reports its own haul, so two land: the frame and its child.
  const hauls = async () => {
    const all = await sw.evaluate(
      () => (globalThis as unknown as { __picks: { type: string; results?: unknown[] }[] }).__picks
    );
    return all.filter((m) => m.type === 'ELEMENTS_PICKED');
  };
  await expect.poll(async () => (await hauls()).length, { message: 'the nested frame reports too' }).toBe(2);

  const results = (await hauls()).flatMap(
    (m) => (m as { results: { suggestedName: string; framePath: { frame: { value: string } }[] }[] }).results
  );
  const paths = results.map((r) => r.framePath.map((s) => s.frame.value).join(' › '));

  // Choosing a frame means choosing its page, and a page includes what it
  // embeds — so the grandchild's controls come too, two steps deep.
  expect(paths, results.map((r) => r.suggestedName).join(', ')).toContain('#same-frame');
  expect(paths).toContain('#same-frame › #deep-frame');

  // The CVV field lives only in the deepest frame.
  const cvv = results.find((r) => r.suggestedName === 'CVV');
  expect(cvv, results.map((r) => r.suggestedName).join(', ')).toBeDefined();
  expect(cvv!.framePath.map((s) => s.frame.value)).toEqual(['#same-frame', '#deep-frame']);

  // And nothing from the main frame or a sibling: the scan started at a frame,
  // it did not sweep the tab.
  expect(paths.every((p) => p.startsWith('#same-frame'))).toBe(true);
});

test('a new highlight clears the last one, in whichever frame it was', async () => {
  // Highlights last ~3s. Clicking a second eye inside that window left both
  // elements marked — and across frames, the stale one was in a document the
  // answering frame could not reach.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'highlight-clears', 'frames.html');
  await page.waitForLoadState('networkidle');

  const marked = async () => {
    let n = 0;
    for (const f of page.frames()) n += await f.locator('[data-page-modeller="highlight"]').count().catch(() => 0);
    return n;
  };

  // First: something in the main frame.
  await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: 'HIGHLIGHT', candidate: { kind: 'css', value: '[data-spike="top-submit"]' }, framePath: [] }),
    tabId
  );
  await expect.poll(marked).toBe(1);

  // Then, well within the 3s window, something two frames deep.
  await sw.evaluate(
    (id) =>
      chrome.tabs.sendMessage(id, {
        type: 'HIGHLIGHT',
        candidate: { kind: 'css', value: '#deep-cvv' },
        framePath: [{ frame: { kind: 'css', value: '#same-frame' } }, { frame: { kind: 'css', value: '#deep-frame' } }],
      }),
    tabId
  );
  // Wait for the NEW mark to appear, then count once, immediately. Polling for
  // the total to fall to 1 would pass without the fix by simply outlasting the
  // stale mark's own 3s timer — which is exactly what it did.
  const deep = page.frameLocator('#same-frame').frameLocator('#deep-frame');
  await expect(deep.locator('[data-page-modeller="highlight"]')).toHaveCount(1, { timeout: 2000 });
  expect(await marked(), 'a frame that did not answer kept its mark').toBe(1);
});

test('a readable frame is never drawn as unreadable', async () => {
  // The warning is Firefox-only by construction — Chrome reads every frame in
  // the fixture — so what Chrome CAN check is that it never appears here. It
  // appeared on every frame once, because the message that records liveness
  // sat below a guard that rejects anything not sent by the parent, and a
  // child is by definition not the parent.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'readable-overlay', 'frames.html');
  await page.waitForLoadState('networkidle');
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add', nonce: 'n' }), tabId);

  const labelText = () =>
    page.evaluate(() => document.querySelector('[data-page-modeller="label"]')?.textContent ?? '');

  let labelled = 0;
  for (const sel of ['#same-frame', '#cross-frame', '#srcdoc-frame', '#sandboxed-frame']) {
    const box = (await page.locator(sel).boundingBox())!;
    // The border, where this frame owns the pointer. Whether a label appears
    // at all depends on which side wins the pointer, and that is not what is
    // being tested — only that when one does appear, it does not lie.
    await page.mouse.move(box.x + 1, box.y + 1);
    await page.waitForTimeout(120);
    const text = await labelText();
    if (text.includes('iframe')) labelled++;
    expect(text, `${sel} is readable on Chrome`).not.toContain('cannot be read');
  }
  // ...and that the check was not vacuous: some frame did get labelled.
  expect(labelled, 'no frame was labelled, so nothing was actually checked').toBeGreaterThan(0);
});

test('a frame that can be read reports nothing', async () => {
  // The timeout must not fire for frames that simply took a moment.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'readable-frame', 'frames.html');
  await page.waitForLoadState('networkidle');
  await collectMessages(sw as never);

  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'scan', nonce: 'n' }), tabId);
  const box = (await page.locator('#same-frame').boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + 1);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(1200);

  const reports = (await sw.evaluate(
    () => (globalThis as unknown as { __picks: { type: string }[] }).__picks
  )).filter((m) => m.type === 'FRAME_UNREADABLE');
  expect(reports, 'a readable frame must not be reported').toEqual([]);
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
        .filter((m) => m.type === 'MODEL')
        .map((m) => m.tabId)
    )
    .toEqual([tabId]);

  // The model the panel receives is the background's, with the element named.
  const published = (await panel.evaluate(
    () => (window as unknown as { __msgs: { type: string; model?: { elements: { name: string }[] } }[] }).__msgs
  )).filter((m) => m.type === 'MODEL');
  expect(published.at(-1)!.model!.elements.map((e) => e.name)).toEqual(['SignIn']);
});

test('both panels on a tab see the same model (SPEC §5)', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  const { page, tabId } = await openFixture(sw as never, 'shared');

  // Two panel pages, standing in for the sidebar and the DevTools panel.
  const panels = [];
  for (let i = 0; i < 2; i++) {
    const p = await context.newPage();
    await p.goto(`chrome-extension://${extId}/devtools-panel.html`);
    await p.evaluate(() => {
      (window as unknown as { __msgs: unknown[] }).__msgs = [];
      chrome.runtime.onMessage.addListener((m) => {
        (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
      });
    });
    panels.push(p);
  }

  // One panel starts a pick.
  await panels[0].evaluate(
    (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'START_PICKING', mode: 'add' } }),
    tabId
  );
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Both see it. A model held in the panel gave each surface its own rows.
  for (const p of panels) {
    await expect
      .poll(async () =>
        (
          await p.evaluate(() => (window as unknown as { __msgs: { type: string; model?: { elements: { name: string }[] } }[] }).__msgs)
        )
          .filter((m) => m.type === 'MODEL')
          .at(-1)?.model?.elements.map((e) => e.name)
      )
      .toEqual(['SignIn']);
  }

  // A panel that opens later asks for the model and gets the same rows.
  const late = await context.newPage();
  await late.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await late.evaluate(() => {
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });
  await late.evaluate((id) => chrome.runtime.sendMessage({ type: 'GET_MODEL', tabId: id }), tabId);
  await expect
    .poll(async () =>
      (await late.evaluate(() => (window as unknown as { __msgs: { type: string; model?: { elements: { name: string }[] } }[] }).__msgs))
        .filter((m) => m.type === 'MODEL')
        .at(-1)?.model?.elements.map((e) => e.name)
    )
    .toEqual(['SignIn']);
});

test('a model dies when the last panel watching its tab closes', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  // Earlier tests leave panel pages open, and the real app connects a port on
  // mount — each is a panel as far as the background is concerned.
  for (const open of context.pages()) {
    if (open.url().startsWith('chrome-extension://')) await open.close();
  }

  const a = await openFixture(sw as never, 'session-a');
  const b = await openFixture(sw as never, 'session-b');

  /** A panel page holding a port and watching `tab`, as the real panels do. */
  async function openPanel(tab: number) {
    const p = await context.newPage();
    await p.goto(`chrome-extension://${extId}/devtools-panel.html`);
    await p.evaluate(
      ([name, id]) => {
        const port = chrome.runtime.connect({ name: name as string });
        port.postMessage({ tabId: id as number });
        (window as unknown as { __port: unknown }).__port = port;
        (window as unknown as { __msgs: unknown[] }).__msgs = [];
        chrome.runtime.onMessage.addListener((m) => {
          (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
        });
      },
      ['page-modeller-panel', tab] as [string, number]
    );
    return p;
  }

  async function pick(fixture: { page: import('@playwright/test').Page; tabId: number }, panel: import('@playwright/test').Page) {
    await panel.evaluate(
      (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'START_PICKING', mode: 'add' } }),
      fixture.tabId
    );
    await fixture.page.getByRole('button', { name: 'Sign in' }).click();
  }

  const namesIn = async (p: import('@playwright/test').Page) =>
    (await p.evaluate(() => (window as unknown as { __msgs: { type: string; model?: { elements: { name: string }[] } }[] }).__msgs))
      .filter((m) => m.type === 'MODEL')
      .at(-1)
      ?.model?.elements.map((e) => e.name);

  // Two panels on tab A, one on tab B; a model built on each.
  const a1 = await openPanel(a.tabId);
  const a2 = await openPanel(a.tabId);
  const b1 = await openPanel(b.tabId);
  await pick(a, a1);
  await pick(b, b1);
  await expect.poll(() => namesIn(a2)).toEqual(['SignIn']);

  // Closing one of tab A's two panels leaves its model alone.
  await a1.close();
  const a3 = await openPanel(a.tabId);
  await a3.evaluate((id) => chrome.runtime.sendMessage({ type: 'GET_MODEL', tabId: id }), a.tabId);
  await expect.poll(() => namesIn(a3)).toEqual(['SignIn']);

  // Closing tab B's only panel drops B — and must NOT depend on whether any
  // panel happens to be open on another tab, which a global count got wrong.
  await b1.close();
  const b2 = await openPanel(b.tabId);
  await b2.evaluate((id) => chrome.runtime.sendMessage({ type: 'GET_MODEL', tabId: id }), b.tabId);
  await expect.poll(() => namesIn(b2)).toEqual([]);

  // Tab A is untouched by any of that.
  await a3.evaluate((id) => chrome.runtime.sendMessage({ type: 'GET_MODEL', tabId: id }), a.tabId);
  await expect.poll(() => namesIn(a3)).toEqual(['SignIn']);
});

test('a roaming sidebar closing on one tab leaves the other tab\'s model', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  for (const open of context.pages()) {
    if (open.url().startsWith('chrome-extension://')) await open.close();
  }

  const a = await openFixture(sw as never, 'roam-a');
  const b = await openFixture(sw as never, 'roam-b');

  // ONE panel, standing in for a side panel that follows the active tab.
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate((name) => {
    const port = chrome.runtime.connect({ name: name as string });
    (window as unknown as { __port: chrome.runtime.Port }).__port = port;
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  }, 'page-modeller-panel');

  const watch = (id: number) =>
    panel.evaluate((t) => (window as unknown as { __port: chrome.runtime.Port }).__port.postMessage({ tabId: t }), id);

  // Build a model on tab A.
  await watch(a.tabId);
  await panel.evaluate(
    (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'START_PICKING', mode: 'add' } }),
    a.tabId
  );
  await a.page.getByRole('button', { name: 'Sign in' }).click();

  // Roam to tab B, then close the panel there.
  await watch(b.tabId);
  await panel.close();

  // Tab A's model must survive: the panel was not watching it when it closed,
  // and roaming away is not the same as finishing.
  const probe = await context.newPage();
  await probe.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await probe.evaluate(() => {
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });
  await probe.evaluate((id) => chrome.runtime.sendMessage({ type: 'GET_MODEL', tabId: id }), a.tabId);
  await expect
    .poll(async () =>
      (await probe.evaluate(() => (window as unknown as { __msgs: { type: string; model?: { elements: { name: string }[] } }[] }).__msgs))
        .filter((m) => m.type === 'MODEL')
        .at(-1)
        ?.model?.elements.map((e) => e.name)
    )
    .toEqual(['SignIn']);
});

test('a model kept across a navigation is marked stale (SPEC §5)', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  for (const open of context.pages()) {
    if (open.url().startsWith('chrome-extension://')) await open.close();
  }

  const { page, tabId } = await openFixture(sw as never, 'stale');

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate(() => {
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });

  const latest = async () =>
    (await panel.evaluate(() => (window as unknown as { __msgs: { type: string; model?: { stale: boolean; url: string | null } }[] }).__msgs))
      .filter((m) => m.type === 'MODEL')
      .at(-1)?.model;

  await panel.evaluate(
    (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'START_PICKING', mode: 'add' } }),
    tabId
  );
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The model records the page it was built on.
  await expect.poll(async () => (await latest())?.url).toContain('login.html?case=stale');
  expect((await latest())?.stale).toBe(false);

  // Navigating away marks it, so the panel can say why every row will miss.
  await page.goto(`http://localhost:${PORT}/widgets.html`);
  await expect.poll(async () => (await latest())?.stale).toBe(true);

  // Navigating back makes it current again — it describes this page once more.
  await page.goto(`http://localhost:${PORT}/login.html?case=stale`);
  await expect.poll(async () => (await latest())?.stale).toBe(false);
});

test('a pick under Selenium never selects a Playwright-only locator', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  for (const open of context.pages()) {
    if (open.url().startsWith('chrome-extension://')) await open.close();
  }

  const { page, tabId } = await openFixture(sw as never, 'selenium');

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate(() => {
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });

  type Published = { type: string; model?: { elements: { selectedIndex: number; candidates: { candidate: { kind: string } }[] }[] } };
  const selectedKinds = async () => {
    const model = (await panel.evaluate(() => (window as unknown as { __msgs: Published[] }).__msgs))
      .filter((m) => m.type === 'MODEL')
      .at(-1)?.model;
    return model?.elements.map((e) => e.candidates[e.selectedIndex]?.candidate.kind);
  };

  await panel.evaluate(
    (id) => chrome.runtime.sendMessage({ type: 'SET_FRAMEWORK', tabId: id, frameworkId: 'selenium-java' }),
    tabId
  );
  await panel.evaluate(
    (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'START_PICKING', mode: 'add' } }),
    tabId
  );
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Selenium's By strategies only. Before this, a Selenium model selected
  // getByRole, showed it as "role: … — …", and the eye certified it, because
  // our resolver understands roles even though Selenium cannot express them.
  const seleniumTypes = ['id', 'linkText', 'partialLinkText', 'name', 'css', 'xpath', 'className', 'tagName'];
  await expect.poll(selectedKinds).toHaveLength(1);
  const [kind] = (await selectedKinds())!;
  expect(seleniumTypes, `selected ${kind}`).toContain(kind);
});

test('the overlay label previews the locator, not just the tag', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'label', 'widgets.html');
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add' }), tabId);
  const label = page.locator('[data-page-modeller="label"]');

  // The label is a breadcrumb ending in the target; the chain itself is covered
  // by the arrow-key test. Here it is the target's description that matters:
  // role first, then the accessible name, previewing what getByRole matches on.
  await page.getByRole('button', { name: 'Save' }).hover();
  await expect(label).toHaveText(/› button "Save"$/);

  // Tag shown only when it differs from the role. This is the case it was
  // written for: a <div role="button"> and the plain <div> wrapping it have the
  // same bounding box and both used to read just "div".
  await page.getByRole('button', { name: 'Continue to checkout' }).hover();
  await expect(label).toHaveText(/› button \(div\) "Continue to checkout"$/);

  // The wrapper is now plainly distinguishable from the control inside it.
  await page.locator('.cta-wrapper').hover({ position: { x: 2, y: 2 } });
  await expect(label).toHaveText(/› div$/);

  // Formatting details — truncation, role="none", missing names — are covered
  // by tests/unit/describe.test.ts against the same function. This test exists
  // for the thing only a real browser can show: that hovering two elements with
  // identical bounding boxes now tells them apart.
});

test('arrow keys walk the target up and down the DOM', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'arrows', 'widgets.html');

  await sw.evaluate(() => {
    const g = globalThis as unknown as { __picks: unknown[]; __collecting?: boolean };
    g.__picks = [];
    if (g.__collecting) return;
    g.__collecting = true;
    // OVERLAY_SHOWN is plumbing — a frame telling the background it drew, so
    // the other frames can clear. The panel ignores it and so does this.
    chrome.runtime.onMessage.addListener((m) => {
      if ((m as { type?: string })?.type !== 'OVERLAY_SHOWN') g.__picks.push(m);
    });
  });
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'START_PICKING', mode: 'add' }), tabId);

  const label = page.locator('[data-page-modeller="label"]');
  await page.getByRole('button', { name: 'Continue to checkout' }).hover();
  // Ancestors are role-or-tag only; the target carries its accessible name.
  await expect(label).toHaveText('body › main › div › button (div) "Continue to checkout"');

  // Up moves to the wrapper — the element that needed a 2px sliver of padding
  // to hit with the mouse.
  await page.keyboard.press('ArrowUp');
  await expect(label).toHaveText('body › main › div');

  // Down walks back towards the element under the cursor.
  await page.keyboard.press('ArrowDown');
  await expect(label).toHaveText('body › main › div › button (div) "Continue to checkout"');

  // The panel drives the same move over a message, because after clicking Add
  // Element focus is in the panel and the page never sees the keydown.
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'MOVE_TARGET', direction: 'up' }), tabId);
  await expect(label).toHaveText('body › main › div');
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'MOVE_TARGET', direction: 'down' }), tabId);
  await expect(label).toHaveText('body › main › div › button (div) "Continue to checkout"');

  // Enter commits the walked-to target: hands are already on the arrows, and
  // the Add Element button still has focus, so an unhandled Enter would
  // re-activate it and cancel the pick.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');

  await expect
    .poll(async () => (await sw.evaluate(() => (globalThis as unknown as { __picks: { type: string }[] }).__picks)).length)
    .toBe(1);
  const picks = await sw.evaluate(() => (globalThis as unknown as { __picks: Record<string, unknown>[] }).__picks);
  const result = picks[0].result as { tag: string; role: string | null };
  expect(result.tag, 'picked the wrapper, not the button under the cursor').toBe('div');
  expect(result.role).toBeNull();
});

test('the model lives outside the service worker, not in it', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  for (const open of context.pages()) {
    if (open.url().startsWith('chrome-extension://')) await open.close();
  }

  const { page, tabId } = await openFixture(sw as never, 'session-storage');

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate(
    ([name, id]) => {
      chrome.runtime.connect({ name: name as string }).postMessage({ tabId: id as number });
    },
    ['page-modeller-panel', tabId] as [string, number]
  );

  await panel.evaluate(
    (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'START_PICKING', mode: 'add' } }),
    tabId
  );
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Chrome terminates the worker after 30s of inactivity, and since Chrome 114
  // an open port does not hold it open. A model in worker memory simply
  // vanished — which is why it "came back" after restarting the browser.
  // storage.session survives that: in memory, cleared when the browser closes,
  // never written to disk, so SPEC §5 still holds.
  await expect
    .poll(async () =>
      panel.evaluate(async (id) => {
        const stored = (await chrome.storage.session.get('models')) as {
          models?: Record<string, { elements: { name: string }[] }>;
        };
        return stored.models?.[id]?.elements.map((e) => e.name);
      }, tabId)
    )
    .toEqual(['SignIn']);
});

test('appendTypeToName changes how a pick is named (SPEC §13)', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  for (const open of context.pages()) {
    if (open.url().startsWith('chrome-extension://')) await open.close();
  }

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate(() => {
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });

  const namesFor = async (id: number) =>
    (await panel.evaluate(() => (window as unknown as { __msgs: { type: string; tabId?: number; model?: { elements: { name: string }[] } }[] }).__msgs))
      .filter((m) => m.type === 'MODEL' && m.tabId === id)
      .at(-1)
      ?.model?.elements.map((e) => e.name);

  async function pickSignIn(caseName: string) {
    const fixture = await openFixture(sw as never, caseName);
    await panel.evaluate(
      (id) => chrome.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: id, message: { type: 'START_PICKING', mode: 'add' } }),
      fixture.tabId
    );
    await fixture.page.getByRole('button', { name: 'Sign in' }).click();
    return fixture.tabId;
  }

  // Off by default — v2.5.1's plain names.
  const plain = await pickSignIn('suffix-off');
  await expect.poll(() => namesFor(plain)).toEqual(['SignIn']);

  // The setting is read per pick, so turning it on takes effect immediately
  // rather than only for a new session.
  await panel.evaluate(() => chrome.storage.sync.set({ options: { appendTypeToName: true } }));
  const suffixed = await pickSignIn('suffix-on');
  await expect.poll(() => namesFor(suffixed)).toEqual(['SignInButton']);

  await panel.evaluate(() => chrome.storage.sync.remove('options'));
});

test('scan adds a container\'s interactive descendants, not the container (SPEC §4)', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;

  for (const open of context.pages()) {
    if (open.url().startsWith('chrome-extension://')) await open.close();
  }

  const { page, tabId } = await openFixture(sw as never, 'scan');

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/devtools-panel.html`);
  await panel.evaluate(() => {
    (window as unknown as { __msgs: unknown[] }).__msgs = [];
    chrome.runtime.onMessage.addListener((m) => {
      (window as unknown as { __msgs: unknown[] }).__msgs.push(m);
    });
  });

  const model = async () =>
    (await panel.evaluate(() => (window as unknown as { __msgs: { type: string; model?: { elements: { name: string; role: string | null }[] } }[] }).__msgs))
      .filter((m) => m.type === 'MODEL')
      .at(-1)?.model;

  await panel.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: 'RELAY_TO_TAB',
        tabId: id,
        message: { type: 'START_PICKING', mode: 'scan', includeHidden: false },
      }),
    tabId
  );

  // Reach the <form> with the arrow keys, which is what they are for: clicking
  // the middle of a form lands on a child input, and scanning that collects
  // nothing. Hover a control inside it, then walk up.
  const label = page.locator('[data-page-modeller="label"]');
  await page.getByRole('button', { name: 'Sign in' }).hover();
  for (let i = 0; i < 5 && !/› form$/.test((await label.textContent()) ?? ''); i++) {
    await page.keyboard.press('ArrowUp');
  }
  await expect(label).toHaveText(/› form$/);
  await page.keyboard.press('Enter');

  await expect.poll(async () => (await model())?.elements.length).toBeGreaterThan(0);
  const elements = (await model())!.elements;

  // Only the form's own controls, and never the form itself.
  expect(elements.map((e) => e.name)).toEqual(['EmailAddress', 'Password', 'RememberMe', 'SignIn']);
  // The password field has NO role — HTML-AAM maps input[type=password] to
  // none — which is exactly why the rule cannot be role-only.
  expect(elements.map((e) => e.role)).toEqual(['textbox', null, 'checkbox', 'button']);

  // Static content inside the form — the four labels — is not collected: a scan
  // of a page would otherwise return every piece of text on it.
  expect(elements).toHaveLength(4);
});

test('a hidden match is marked on its nearest visible ancestor', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

  const { page, tabId } = await openFixture(sw as never, 'hidden-eye', 'edgecases.html');
  await collectMessages(sw as never);

  const marks = page.locator('[data-page-modeller="highlight"]');

  // A visible control marks itself, solid.
  await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: 'HIGHLIGHT', candidate: { kind: 'css', value: '#hidden-host' } }),
    tabId
  );
  await expect(marks).toHaveCount(1);
  await expect(marks.first()).not.toHaveAttribute('data-hidden', 'true');

  // A hidden one has no box of its own, so it is marked on the nearest
  // ancestor that has one — dashed, and captioned, rather than drawn nowhere.
  await sw.evaluate(
    (id) =>
      chrome.tabs.sendMessage(id, {
        type: 'HIGHLIGHT',
        candidate: { kind: 'css', value: '[data-spike="hidden-in-visible-parent"]' },
      }),
    tabId
  );
  await expect(marks).toHaveCount(1);
  await expect(marks.first()).toHaveAttribute('data-hidden', 'true');
  await expect(marks.first()).toContainText('hidden element');

  // And the count says so, or "1 element matches" with nothing outlined where
  // you expected it reads as a failure.
  await expect
    .poll(async () =>
      (await sw.evaluate(() => (globalThis as unknown as { __picks: { type: string; hidden?: number }[] }).__picks))
        .filter((m) => m.type === 'HIGHLIGHT_RESULT')
        .at(-1)?.hidden
    )
    .toBe(1);
});
