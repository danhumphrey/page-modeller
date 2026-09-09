import { test, expect, chromium } from '@playwright/test';
import puppeteer, { type Browser } from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { puppeteerSelector } from '../src/locators/display';
import { frameworkById } from '../src/frameworks';
import type { ElementResult } from '../src/engine/types';

// The Playwright fidelity spec's counterpart, in a real Puppeteer.
//
// Puppeteer's P-selectors are the one part of the tool whose semantics we do
// not implement: `::-p-aria` is answered by CDP's accessibility tree, not by
// our resolver. Reasoning from the docs is how the `xpath=` bug got shipped, so
// this resolves every generated selector for real.
//
// puppeteer-core, driving Playwright's chromium — no second browser download.
const FIXTURES = ['login.html', 'widgets.html', 'ambiguous.html', 'edgecases.html'];
const PUPPETEER_KINDS = new Set(frameworkById('puppeteer').locatorTypes);

test('Puppeteer resolves every selector we generate for it', async () => {
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({ executablePath: chromium.executablePath(), headless: true });
  } catch (e) {
    test.skip(true, `no chromium for puppeteer-core: ${String(e).split('\n')[0]}`);
    return;
  }

  const failures: string[] = [];
  try {
    const page = await browser.newPage();

    for (const fixture of FIXTURES) {
      await page.goto(pathToFileURL(resolve('tests/fixtures', fixture)).href);
      await page.addScriptTag({ path: resolve('.test-dist/engine.global.js') });

      const handles = await page.$$('[data-spike]');
      expect(handles.length, `${fixture} has tagged elements`).toBeGreaterThan(0);

      for (const handle of handles) {
        const { spikeId, result } = await handle.evaluate((el) => ({
          spikeId: el.getAttribute('data-spike'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result: (window as any).__spike.generate(el) as ElementResult,
        }));

        for (const { candidate, predictedCount } of result.candidates) {
          if (!PUPPETEER_KINDS.has(candidate.kind)) continue;
          const selector = puppeteerSelector(candidate);

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
});
