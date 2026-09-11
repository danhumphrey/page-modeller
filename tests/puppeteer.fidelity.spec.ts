import { test, expect, chromium } from '@playwright/test';
import puppeteer, { type Browser } from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { puppeteerSelector } from '../src/locators/display';
import { puppeteerShadowSelector } from '../src/locators/shadow';
import { frameworkById } from '../src/frameworks';
import type { ElementResult } from '../src/engine/types';
import { REQUIRE_FULL_SUITE } from './required';

// The Playwright fidelity spec's counterpart, in a real Puppeteer.
//
// Puppeteer's P-selectors are the one part of the tool whose semantics we do
// not implement: `::-p-aria` is answered by CDP's accessibility tree, not by
// our resolver. Reasoning from the docs is how the `xpath=` bug got shipped, so
// this resolves every generated selector for real.
//
// puppeteer-core, driving Playwright's chromium — no second browser download.
const FIXTURES = ['login.html', 'widgets.html', 'ambiguous.html', 'edgecases.html', 'shadow.html'];
const PUPPETEER_KINDS = new Set(frameworkById('puppeteer').locatorTypes);

test('Puppeteer resolves every selector we generate for it', async () => {
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath: chromium.executablePath(),
      headless: true,
      // Chrome's sandbox needs kernel privileges a CI container does not grant.
      // Playwright passes this for us; puppeteer-core does not.
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (e) {
    const why = `puppeteer-core could not launch chromium: ${String(e).split('\n')[0]}`;
    // Silently skipping is how this check stops running without anyone
    // noticing — it did exactly that on its first CI run.
    if (REQUIRE_FULL_SUITE) throw new Error(`PM_REQUIRE_FULL_SUITE is set. ${why}`);
    test.skip(true, why);
    return;
  }

  const failures: string[] = [];
  // Selectors that actually crossed a boundary. Without this the suite passes
  // just as happily on a model containing no shadow elements at all.
  let deepSelectors = 0;
  try {
    const page = await browser.newPage();

    for (const fixture of FIXTURES) {
      await page.goto(pathToFileURL(resolve('tests/fixtures', fixture)).href);
      await page.addScriptTag({ path: resolve('.test-dist/engine.global.js') });

      // Walked explicitly rather than with `page.$$('[data-spike]')`, which
      // does not pierce — every tagged element in shadow.html would have been
      // invisible and the fixture would have proved nothing (SPEC §19).
      //
      // Not with `>>>` either, even though it would reach them: that is the
      // combinator under test here, so using it to find the elements it is
      // being tested on would assume the answer.
      const tagged = await page.evaluate(() => {
        const out: { spikeId: string; result: ElementResult }[] = [];
        const walk = (root: Document | ShadowRoot) => {
          for (const el of Array.from(root.querySelectorAll('*'))) {
            const id = el.getAttribute('data-spike');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (id) out.push({ spikeId: id, result: (window as any).__spike.generate(el) as ElementResult });
            if (el.shadowRoot) walk(el.shadowRoot);
          }
        };
        walk(document);
        return out;
      });
      expect(tagged.length, `${fixture} has tagged elements`).toBeGreaterThan(0);

      for (const { spikeId, result } of tagged) {

        for (const { candidate, predictedCount } of result.candidates) {
          if (!PUPPETEER_KINDS.has(candidate.kind)) continue;
          // The selector the generator actually emits: hosts joined with the
          // deep combinator in front of the element's own (SPEC §19).
          const selector = puppeteerShadowSelector(result.shadowPath, puppeteerSelector(candidate));
          if (selector.includes('>>>')) deepSelectors++;

          let matched: string[] | string;
          try {
            const found = await page.$$(selector);
            matched = await Promise.all(found.map((h) => h.evaluate((el) => el.getAttribute('data-spike') ?? '')));
          } catch (e) {
            matched = `threw: ${String(e).split('\n')[0]}`;
          }

          if (typeof matched === 'string') {
            failures.push(`${fixture}/${spikeId}: ${selector} ${matched}`);
            continue;
          }
          if (matched.length !== predictedCount) {
            failures.push(
              `${fixture}/${spikeId}: ${selector} matched ${matched.length}, engine predicted ${predictedCount}`
            );
          }
          // Agreement is not enough — it must find the element it came from.
          if (!matched.includes(spikeId ?? '')) {
            failures.push(`${fixture}/${spikeId}: ${selector} does not find ${spikeId}`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  expect(failures, `${failures.length} Puppeteer selector failures`).toEqual([]);
  expect(deepSelectors, 'selectors that crossed a shadow boundary').toBeGreaterThan(10);
});
