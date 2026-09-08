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

      // Every candidate's predicted count must equal Playwright's real count.
      // The engine's in-page resolver is our own approximation of Playwright
      // semantics — text matching, `exact`, whitespace normalisation — and the
      // eye (SPEC §8) reports from it. If the two drift, the count the user is
      // shown is not the count their test will get.
      for (const { candidate, predictedCount } of result.candidates) {
        const loc = buildLocator(page, candidate);
        const actual = await loc.count();
        if (actual !== predictedCount) {
          failures.push(
            `${fixture}/${spikeId}: ${candidate.kind} predicted ${predictedCount}, Playwright resolved ${actual}`
          );
        }

        // Agreement is not enough: a candidate that resolves to nothing agrees
        // with our resolver, which also finds nothing, and passes. Every
        // candidate must actually FIND the element it was generated from —
        // that is what caught XPath silently failing on SVG, where an
        // unprefixed name test matches no non-HTML-namespace element.
        if (actual === 0) {
          failures.push(`${fixture}/${spikeId}: ${candidate.kind} matches nothing`);
          continue;
        }
        const findsIt = await loc.evaluateAll((els, id) => els.some((e) => e.getAttribute('data-spike') === id), spikeId);
        if (!findsIt) {
          failures.push(`${fixture}/${spikeId}: ${candidate.kind} resolves, but not to ${spikeId}`);
        }
      }

      // css and xpath are unconditional fallbacks: the engine emits them for
      // every element, and candidates that cannot find their element are
      // dropped. So a missing one means the generator is broken for this shape
      // — which is how SVG XPaths, silently resolving to nothing, were caught.
      const kinds = result.candidates.map((c) => c.candidate.kind);
      for (const required of ['css', 'xpath'] as const) {
        if (!kinds.includes(required)) failures.push(`${fixture}/${spikeId}: no working ${required} candidate`);
      }

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
