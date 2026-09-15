import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import './spike';

// What "hidden" means to a scan (SPEC §4), measured where layout actually
// happens — jsdom has none, so every box there is 0x0 and it cannot answer
// this at all.
//
// The case is taken from a real page: an EMPTY <a> in a cookie banner. Nothing
// in its chain is display:none or visibility:hidden, so it is exposed to the
// accessibility tree and Playwright's getByRole('link') matches it — and an
// empty inline element generates no line box, so it draws nothing, and the eye
// could only mark it on its nearest visible ancestor as a "hidden element".
// A scan with "model hidden elements" OFF collected it anyway, which is the
// tool contradicting the setting the user had just turned off.
const ENGINE = resolve('.test-dist/engine.global.js');

const FIXTURE = `
  <main>
    <a id="normal" href="/a">Visible link</a>
    <button id="belowfold" style="margin-top:3000px">Far down</button>
    <a id="sronly" href="/b"
       style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Skip to content</a>
    <button id="zerowidth" style="width:0;height:20px;padding:0;border:0"></button>
    <div><a id="empty" href="/industries/"></a></div>
    <a id="nodisplay" href="/c" style="display:none">Gone</a>
    <a id="invisible" href="/d" style="visibility:hidden">Also gone</a>
    <a id="ariahidden" href="/e" aria-hidden="true">Ghost</a>
  </main>`;

test.beforeEach(async ({ page }) => {
  await page.setContent(FIXTURE);
  await page.addScriptTag({ path: ENGINE });
});

const ids = (page: import('@playwright/test').Page, includeHidden: boolean) =>
  page.evaluate(
    (hidden) => window.__spike.collectInteractive(document.body, hidden).map((el) => el.id),
    includeHidden
  );

test('the empty link is in the accessibility tree, which is why this needed deciding', async ({ page }) => {
  // Not incidental: SPEC §4 anchors the default on accessibility-tree exposure
  // BECAUSE that is what getByRole applies. This element passes that test, so
  // excluding it is a deliberate narrowing rather than a correction.
  const matched = await Promise.all(
    (await page.getByRole('link').elementHandles()).map((h) => h.evaluate((e) => e.id))
  );
  expect(matched, 'getByRole sees it').toContain('empty');
  expect(matched, 'and does not see the display:none one').not.toContain('nodisplay');

  // And it really does draw nothing — an empty inline generates no line box.
  const box = await page.locator('#empty').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return `${r.width}x${r.height}`;
  });
  expect(box).toBe('0x0');
});

test('a scan skips what renders nothing, and keeps what merely cannot be seen yet', async ({ page }) => {
  // Below the fold and screen-reader-only are NOT hidden: both are operable,
  // and a test drives them. Only the one that draws nothing goes.
  expect(await ids(page, false)).toEqual(['normal', 'belowfold', 'sronly', 'zerowidth']);
});

test('the setting means what it says', async ({ page }) => {
  expect(await ids(page, true)).toEqual([
    'normal',
    'belowfold',
    'sronly',
    'zerowidth',
    'empty',
    'nodisplay',
    'invisible',
    'ariahidden',
  ]);
});

test('width OR height, not both — a zero-width control still renders', async ({ page }) => {
  // The rule catches what draws NOTHING, and must not widen into "anything
  // with no width": a control can be 0 wide and still be a real, visible,
  // clickable strip.
  const box = await page.locator('#zerowidth').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  expect(box).toEqual({ w: 0, h: 20 });
  expect(await ids(page, false)).toContain('zerowidth');
});
