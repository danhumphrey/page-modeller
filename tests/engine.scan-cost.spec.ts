import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import './spike';

// A scan asks the whole document several questions per element — every
// element's role, every element's accessible name, every element matching a
// selector — and nothing about the page changes between those calls. All of it
// was recomputed for each one, so the cost was quadratic in the page: a page of
// 600 repeated rows took 16 seconds with the tab's main thread held for all of
// it, and the panel said nothing in the meantime.
//
// Two things are checked here, and only one of them is a timing: that the memo
// changes no answer, and that the cost has not gone back.
const ENGINE = resolve('.test-dist/engine.global.js');

/** A page with `rows` sections, a group of four controls on every `per`th. */
async function bigPage(page: import('@playwright/test').Page, rows: number, per: number) {
  await page.setContent('<body><div id="r"></div></body>');
  await page.evaluate(
    ([n, step]) => {
      let html = '';
      for (let i = 0; i < n; i++) {
        const controls =
          i % step === 0
            ? `<label for="f${i}">Field ${i}</label><input id="f${i}" name="f${i}">
               <button>Go ${i}</button><a href="#x${i}">Link ${i}</a>`
            : '';
        html += `<section class="s${i}"><div><span>Row ${i}</span><p>text ${i}</p>${controls}</div></section>`;
      }
      document.getElementById('r')!.innerHTML = html;
    },
    [rows, per] as [number, number]
  );
  await page.addScriptTag({ path: ENGINE });
}

test('the batch memo changes no answer', async ({ page }) => {
  // The property that makes the memo safe to have at all: every entry point
  // still works uncached, and `batched` only makes it faster. If these ever
  // disagree, the cache is holding something that was not constant.
  await bigPage(page, 60, 1);

  const same = await page.evaluate(() => {
    const spike = window.__spike;
    const els = spike.collectInteractive(document.body, false);
    const plain = els.map((el) => JSON.stringify(spike.generate(el)));
    const cached = spike.batched(() => els.map((el) => JSON.stringify(spike.generate(el))));
    return { plain, cached, count: els.length };
  });

  expect(same.count).toBe(180);
  expect(same.cached).toEqual(same.plain);
});

test('the memo is what keeps a scan off the quadratic path', async ({ page }) => {
  // A RATIO, not a stopwatch. The first version of this asserted the scan took
  // under 10 seconds — 3.6s locally, which read as generous until a shared CI
  // runner came in at 10.18s and failed a pull request that had not touched the
  // engine. Wall-clock on a machine you do not own measures the machine.
  //
  // Comparing the two paths in the same run cancels the machine out entirely:
  // however slow the box, uncached is the quadratic one and cached is not. Take
  // the memo away and this collapses towards 1.
  await bigPage(page, 300, 1);

  const t = await page.evaluate(() => {
    const spike = window.__spike;
    const els = spike.collectInteractive(document.body, false);

    // Warm the browser up on a slice, so neither figure pays for first-run JIT.
    for (const el of els.slice(0, 20)) spike.generate(el);

    const t0 = performance.now();
    for (const el of els) spike.generate(el);
    const uncached = performance.now() - t0;

    const t1 = performance.now();
    spike.batched(() => {
      for (const el of els) spike.generate(el);
    });
    const cached = performance.now() - t1;

    return { uncached, cached, found: els.length };
  });

  expect(t.found).toBe(900);
  // Measured at roughly 4x locally. Asserting 2x leaves room for a loaded CI
  // box without leaving room for the memo to have stopped working.
  expect(
    t.uncached / t.cached,
    `${Math.round(t.uncached)}ms uncached vs ${Math.round(t.cached)}ms cached`
  ).toBeGreaterThan(2);
});
