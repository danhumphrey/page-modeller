import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { buildLocator } from './pw-builder';
import './spike';

// The engine against real web components (SPEC §19).
//
// A real browser rather than jsdom, because what a component renders is decided
// by the browser: `attachShadow`, slot distribution, and whether a closed root
// is detectable at all are exactly the things a DOM emulation is least likely
// to agree with.
//
// `shadow.probe.spec.ts` says what the frameworks do. This says the engine
// agrees with them.
const FIXTURE = pathToFileURL(resolve('tests/fixtures/shadow.html')).href;
const ENGINE = resolve('.test-dist/engine.global.js');


test.beforeEach(async ({ page }) => {
  await page.goto(FIXTURE);
  await page.addScriptTag({ path: ENGINE });
});

test('a scan collects controls inside open shadow roots', async ({ page }) => {
  const names = await page.evaluate(() =>
    window.__spike
      .collectInteractive(document.body, false)
      .map((el) => el.getAttribute('data-spike') ?? `${el.localName}:${el.getAttribute('name') ?? ''}`)
  );

  // The bug this whole section exists for: before, this returned only the
  // light-DOM button and nothing from any component.
  expect(names).toContain('mirrored-input');
  expect(names).toContain('plain-input');
  expect(names).toContain('plain-link');
  // Two boundaries deep.
  expect(names).toContain('nested-input');
  // And still everything in the light DOM.
  expect(names).toContain('top-submit');
  expect(names).toContain('slotted-button');

  // Slotted content must appear exactly once: it is an ordinary child of the
  // host, and a walk that also descended through the <slot> would double it.
  expect(names.filter((n) => n === 'slotted-button')).toHaveLength(1);

  // Nothing from the closed root, because nothing there is reachable.
  expect(names).not.toContain('secret');
});

test('shadowPathOf records the hosts, outermost first', async ({ page }) => {
  const paths = await page.evaluate(() => {
    const spike = window.__spike;
    const at = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? spike.shadowPathOf(el).map(spike.shadowSelector) : null;
    };
    // Light DOM: no path at all.
    const light = spike.shadowPathOf(document.querySelector('[data-spike="top-submit"]')!);
    // One boundary, two boundaries, and slotted light DOM.
    const shallow = spike.shadowPathOf(
      document.querySelector('plain-field:not(.twin)')!.shadowRoot!.querySelector('[data-spike="plain-input"]')!
    );
    const deep = spike.shadowPathOf(
      document
        .querySelector('outer-panel')!
        .shadowRoot!.querySelector('inner-field')!
        .shadowRoot!.querySelector('[data-spike="nested-input"]')!
    );
    const slotted = spike.shadowPathOf(document.querySelector('[data-spike="slotted-button"]')!);
    return {
      light: light.map(spike.shadowSelector),
      shallow: shallow.map(spike.shadowSelector),
      deep: deep.map(spike.shadowSelector),
      slotted: slotted.map(spike.shadowSelector),
      at,
    };
  });

  expect(paths.light).toEqual([]);
  expect(paths.shallow).toHaveLength(1);
  expect(paths.deep).toHaveLength(2);

  // Slotted light DOM is NOT in a shadow root — only its rendering moves there.
  // A walk over the flat tree would wrongly give it a path.
  expect(paths.slotted).toEqual([]);
});

test('every shadow host selector resolves to exactly one element', async ({ page }) => {
  // A host is located in its own tree, so the outer one is checked against the
  // document and the inner against the outer's root.
  const check = await page.evaluate(() => {
    const spike = window.__spike;
    const input = document
      .querySelector('outer-panel')!
      .shadowRoot!.querySelector('inner-field')!
      .shadowRoot!.querySelector('[data-spike="nested-input"]')!;
    const path = spike.shadowPathOf(input).map(spike.shadowSelector);
    const outer = document.querySelectorAll(path[0]!).length;
    const inner = document.querySelector(path[0]!)!.shadowRoot!.querySelectorAll(path[1]!).length;
    return { path, outer, inner };
  });

  expect(check.outer, `outer host ${check.path[0]}`).toBe(1);
  expect(check.inner, `inner host ${check.path[1]}`).toBe(1);
});

test('two identical components are told apart by their host', async ({ page }) => {
  // The case that decides whether the path is needed at all for Playwright:
  // the inputs are indistinguishable, the hosts are not.
  const hosts = await page.evaluate(() => {
    const spike = window.__spike;
    return ['#twin-one', '#twin-two'].map((sel) => {
      const input = document.querySelector(sel)!.shadowRoot!.querySelector('input')!;
      return spike.shadowPathOf(input).map(spike.shadowSelector).join(' >>> ');
    });
  });

  expect(hosts[0]).not.toBe(hosts[1]);
  for (const host of hosts) await expect(page.locator(host)).toHaveCount(1);
});

test('candidates for a shadow element are scoped to its root, and exclude xpath', async ({ page }) => {
  const result = await page.evaluate(() => {
    const input = document.querySelector('plain-field:not(.twin)')!.shadowRoot!.querySelector('input')!;
    return window.__spike.generate(input);
  });

  const kinds = result.candidates.map((c) => c.candidate.kind);
  // No engine can XPath into a shadow tree, so the candidate must not survive.
  expect(kinds, 'xpath must not be offered for a shadow element').not.toContain('xpath');
  // And the ordinary ones must still be there, counted within the root: three
  // components share this placeholder, but only one is in THIS root.
  expect(kinds).toContain('placeholder');
  expect(kinds).toContain('name');
  const placeholder = result.candidates.find((c) => c.candidate.kind === 'placeholder');
  expect(placeholder, 'a placeholder candidate').toBeDefined();
  expect(placeholder!.predictedCount, 'counted within the shadow root, not the document').toBe(1);
});

test('a shadow element scoped by its host resolves uniquely in real Playwright', async ({ page }) => {
  // The whole point: what the engine predicts is what Playwright finds.
  const { host, candidate } = await page.evaluate(() => {
    const spike = window.__spike;
    const input = document.querySelector('#twin-two')!.shadowRoot!.querySelector('input')!;
    const result = spike.generate(input);
    return {
      host: spike.shadowPathOf(input).map(spike.shadowSelector).join(' '),
      candidate: result.candidates[result.preferredIndex]!.candidate,
    };
  });

  const scoped = buildLocator(page.locator(host), candidate);
  await expect(scoped).toHaveCount(1);
  // And it is the right one.
  await expect(scoped).toHaveAttribute('data-spike', 'plain-input');
});

test('a closed root is reported, and nothing else is', async ({ page }) => {
  const closed = await page.evaluate(() =>
    window.__spike.collectClosedHosts(document.body).map((el) => el.localName)
  );

  // Exactly the closed one. Every open component must be absent, or a scan
  // would warn about every web component on the page and the warning would
  // mean nothing.
  expect(closed).toEqual(['closed-field']);
});

test('a host that mirrors an attribute does not double the count', async ({ page }) => {
  // Etsy's shape, and the bug it caused: <clg-text-input name="password">
  // carries `name` on the host AND on the <input> inside its shadow root, so
  // `[name=password]` matches two elements from the document. The model
  // counted the input within its own root and said 1; the eye resolved against
  // the page and said 2, contradicting it on a locator that was fine.
  const counts = await page.evaluate(() => {
    const spike = window.__spike;
    const host = document.querySelector('mirrored-field')!;
    const input = host.shadowRoot!.querySelector('input')!;
    const result = spike.generate(input);
    const nameCandidate = result.candidates.find((c) => c.candidate.kind === 'name');
    const c = nameCandidate!.candidate;
    return {
      // What the model records: counted inside the element's own root.
      predicted: nameCandidate?.predictedCount ?? -1,
      // What the eye reported before it was scoped — the resolver pierces, so
      // from the document it finds the host AND the control inside it.
      unscoped: spike.resolveCandidate(document, c).length,
      // And what it reports now, resolved where the locator is relative to.
      scoped: spike.resolveCandidate(host.shadowRoot!, c).length,
      path: spike.shadowPathOf(input).map(spike.shadowSelector),
    };
  });

  // The reported bug: two matches for a locator the model called unique.
  expect(counts.unscoped, 'resolving from the document finds the host too').toBe(2);
  // Both halves of the fix agree now.
  expect(counts.predicted, 'counted within the shadow root').toBe(1);
  expect(counts.scoped, 'the eye resolves in the same root').toBe(1);
  // One host, and it resolves to the component — not asserted as a literal
  // selector, because `cssFor` prefers `[name]` over the tag and which one it
  // picks is its business, not this test's.
  expect(counts.path).toHaveLength(1);
  await expect(page.locator(counts.path[0]!)).toHaveCount(1);
  await expect(page.locator(counts.path[0]!)).toHaveJSProperty('localName', 'mirrored-field');
});
