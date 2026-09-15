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

test('a scan of a large page stays well clear of the old cost', async ({ page }) => {
  await bigPage(page, 600, 1);

  const ms = await page.evaluate(() => {
    const spike = window.__spike;
    const els = spike.collectInteractive(document.body, false);
    const t0 = performance.now();
    spike.batched(() => {
      for (const el of els) spike.generate(el);
    });
    return { elapsed: performance.now() - t0, found: els.length };
  });

  expect(ms.found).toBe(1800);
  // Measured at ~3.6s here against ~16s before the memo. The bound is loose on
  // purpose: this is a guard against the quadratic coming back, not a
  // benchmark, and CI machines are slower and share their cores.
  expect(ms.elapsed, `${Math.round(ms.elapsed)}ms for ${ms.found} controls`).toBeLessThan(10_000);
});
