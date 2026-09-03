import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { buildLocator } from './pw-builder';
import type { ElementResult } from '../src/engine/types';

// The crown-jewel correctness gate: every locator the engine deems unique must
// resolve uniquely to the correct element in a REAL Playwright run.
const FIXTURES = ['login.html', 'widgets.html', 'ambiguous.html', 'edgecases.html'];

test('locator engine matches real Playwright resolution', async ({ page }) => {
  const failures: string[] = [];

  for (const fixture of FIXTURES) {
    await page.goto(pathToFileURL(resolve('tests/fixtures', fixture)).href);
    await page.addScriptTag({ path: resolve('.test-dist/engine.global.js') });

    const handles = await page.$$('[data-spike]');
    expect(handles.length, `${fixture} has tagged elements`).toBeGreaterThan(0);

    for (const handle of handles) {
      const { spikeId, result } = await handle.evaluate((el) => ({
        spikeId: el.getAttribute('data-spike'),
        result: window.__spike.generate(el) as ElementResult,
      }));

      if (result.preferredIndex < 0) {
        failures.push(`${fixture}/${spikeId}: no unique candidate`);
        continue;
      }
      const preferred = result.candidates[result.preferredIndex].candidate;
      const loc = buildLocator(page, preferred);
      const count = await loc.count();
      const sid = count === 1 ? await loc.getAttribute('data-spike') : null;
      if (count !== 1 || sid !== spikeId) {
        failures.push(`${fixture}/${spikeId}: ${preferred.kind} resolved count=${count} (expected unique → ${spikeId})`);
      }
    }
  }

  expect(failures, 'engine/Playwright divergences').toEqual([]);
});

declare global {
  interface Window {
    __spike: { generate(el: Element): ElementResult };
  }
}
