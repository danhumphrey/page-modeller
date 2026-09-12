import { test, expect, type Page, type Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { buildLocator } from './pw-builder';
import { playwrightExpr } from '../src/locators/display';
import { playwrightShadowPrefix } from '../src/locators/shadow';
import { frameworkById } from '../src/frameworks';
import type { ElementResult } from '../src/engine/types';
import './spike';

const PLAYWRIGHT_KINDS = new Set(frameworkById('playwright-ts').locatorTypes);

// The crown-jewel correctness gate: every locator the engine deems unique must
// resolve uniquely to the correct element in a REAL Playwright run.
const FIXTURES = ['login.html', 'widgets.html', 'ambiguous.html', 'edgecases.html', 'shadow.html'];

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

      // A shadow element's candidates are generated and counted within its
      // root, so they must be RESOLVED there too (SPEC §19). Scoping by the
      // host chain is exactly what the generator emits, so this checks the
      // shape a user actually gets rather than an idealised one.
      //
      // `page.$$('[data-spike]')` reaches these at all because Playwright's css
      // pierces — which is also why an unscoped count would be the number of
      // identical components on the page rather than 1.
      const shadowPath = result.shadowPath ?? [];
      const scope = shadowPath.reduce<Page | Locator>(
        (acc, step) => acc.locator((step.host as { value: string }).value),
        page
      );

      // Every candidate's predicted count must equal Playwright's real count.
      // The engine's in-page resolver is our own approximation of Playwright
      // semantics — text matching, `exact`, whitespace normalisation — and the
      // eye (SPEC §8) reports from it. If the two drift, the count the user is
      // shown is not the count their test will get.
      for (const { candidate, predictedCount } of result.candidates) {
        const loc = buildLocator(scope, candidate);
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

        // And the GENERATED STRING, not just the IR. `playwrightExpr` is what
        // lands in the user's page object, and it has its own way to be wrong
        // independently of the candidate being right: an XPath needs the
        // `xpath=` prefix, because Playwright infers XPath only from a leading
        // `//` or `..` and the engine's fallback path starts with one slash.
        if (PLAYWRIGHT_KINDS.has(candidate.kind)) {
          // The prefix the generator adds, so the string under test is the
          // one that lands in the page object.
          const expr = playwrightShadowPrefix(shadowPath) + playwrightExpr(candidate);
          const generated = await new Function('page', `return page.${expr};`)(page)
            .count()
            .catch((e: Error) => `threw: ${String(e).split('\n')[0]}`);
          if (generated !== actual) {
            failures.push(`${fixture}/${spikeId}: page.${expr} gave ${generated}, expected ${actual}`);
          }
        }
      }

      // css and xpath are unconditional fallbacks: the engine emits them for
      // every element, and candidates that cannot find their element are
      // dropped. So a missing one means the generator is broken for this shape
      // — which is how SVG XPaths, silently resolving to nothing, were caught.
      const kinds = result.candidates.map((c) => c.candidate.kind);
      // xpath cannot address a shadow tree in ANY engine (SPEC §19), so its
      // absence there is the correct answer rather than a missing fallback.
      // Asserted the other way round as well: it must be gone, or the model
      // would offer Selenium a locator that answers `invalid locator`.
      const required = shadowPath.length > 0 ? (['css'] as const) : (['css', 'xpath'] as const);
      for (const kind of required) {
        if (!kinds.includes(kind)) failures.push(`${fixture}/${spikeId}: no working ${kind} candidate`);
      }
      if (shadowPath.length > 0 && kinds.includes('xpath')) {
        failures.push(`${fixture}/${spikeId}: xpath offered for a shadow element`);
      }

      if (result.preferredIndex < 0) {
        failures.push(`${fixture}/${spikeId}: no unique candidate`);
        continue;
      }
      const preferred = result.candidates[result.preferredIndex]!.candidate;
      const loc = buildLocator(scope, preferred);
      const count = await loc.count();
      const sid = count === 1 ? await loc.getAttribute('data-spike') : null;
      if (count !== 1 || sid !== spikeId) {
        failures.push(`${fixture}/${spikeId}: ${preferred.kind} resolved count=${count} (expected unique → ${spikeId})`);
      }
    }
  }

  expect(failures, 'engine/Playwright divergences').toEqual([]);
});
