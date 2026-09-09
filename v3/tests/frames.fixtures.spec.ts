import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

// The frame fixtures are only useful if the browser really builds the tree they
// describe — a cross-origin child that turns out same-origin, or a srcdoc that
// never loads, would make every frame test that follows quietly meaningless.
//
// Served over http, not file://: Chrome gives every file:// document an opaque
// origin, so `localhost` vs `127.0.0.1` would prove nothing.
const PORT = 5288;
const BASE = `http://localhost:${PORT}`;

let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('node', [resolve('scripts/serve-fixtures.mjs')], {
    env: { ...process.env, FIXTURES_PORT: String(PORT) },
    stdio: 'ignore',
  });
  // Poll rather than sleep: the server is ready when it answers.
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/login.html`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('fixtures server did not start');
});

test.afterAll(() => server?.kill());

test('frames.html builds the frame tree the fixture describes', async ({ page }) => {
  await page.goto(`${BASE}/frames.html`);
  await page.waitForLoadState('networkidle');

  const urls = page.frames().map((f) => f.url());
  // main + same + cross + deep×2 (one under same, one under cross) + srcdoc +
  // sandboxed + twin×2
  expect(page.frames().length, urls.join('\n')).toBe(9);

  // Genuinely cross-origin: a different origin string, not just a different path.
  const cross = page.frames().find((f) => f.url().startsWith('http://127.0.0.1:'));
  expect(cross, urls.join('\n')).toBeDefined();
  await expect(cross!.locator('[data-spike="child-submit"]')).toHaveText('Submit');

  // And the browser agrees it is cross-origin: reaching into it from the parent
  // throws, which is exactly what makes frame-path assembly hard.
  const reachable = await page.evaluate(() => {
    const el = document.querySelector('#cross-frame') as HTMLIFrameElement;
    try {
      return el.contentDocument !== null;
    } catch {
      return false;
    }
  });
  expect(reachable, '#cross-frame must be opaque to its parent').toBe(false);

  // Nested two deep, under the same-origin child.
  const deep = page.frameLocator('#same-frame').frameLocator('#deep-frame');
  await expect(deep.locator('[data-spike="deep-cvv"]')).toBeVisible();

  // srcdoc and sandbox both load and hold their controls.
  await expect(page.frameLocator('#srcdoc-frame').locator('[data-spike="srcdoc-coupon"]')).toBeVisible();
  await expect(page.frameLocator('#sandboxed-frame').locator('[data-spike="sandbox-submit"]')).toBeVisible();
});

test('the Submit buttons collide, so only a frame path separates them', async ({ page }) => {
  await page.goto(`${BASE}/frames.html`);
  await page.waitForLoadState('networkidle');

  // The point of the fixture: one accessible name, many elements, each in a
  // different frame. getByRole in the main frame sees only its own.
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toHaveCount(1);
  for (const scope of ['#same-frame', '#cross-frame', '#srcdoc-frame', '#sandboxed-frame']) {
    await expect(page.frameLocator(scope).getByRole('button', { name: 'Submit', exact: true })).toHaveCount(1);
  }
  // Nine in total across the tree — main, both children, both grandchildren,
  // srcdoc, sandbox and both twins — every one of them indistinguishable from
  // the others to a locator with no frame path.
  const submits = await Promise.all(
    page.frames().map((f) => f.locator('button', { hasText: /^Submit$/ }).count())
  );
  expect(submits.reduce((a, b) => a + b, 0)).toBe(9);
});

test('frameset.html uses frame elements, not iframe', async ({ page }) => {
  await page.goto(`${BASE}/frameset.html`);
  await page.waitForLoadState('networkidle');

  // `frame` and `iframe` are different elements: a selector for one misses the
  // other, which is the whole reason this fixture exists.
  expect(await page.locator('frame').count()).toBe(3);
  expect(await page.locator('iframe').count()).toBe(0);

  // Named frames, the way switchTo().frame("nav") addresses them.
  await expect(page.frameLocator('frame[name="nav"]').locator('[data-spike="child-heading"]')).toHaveText('Payment');
  await expect(page.frameLocator('frame[name="lower"]').locator('[data-spike="deep-submit"]')).toHaveText('Submit');
});
