import { test, expect } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generatePlaywrightPythonPageObject } from '../src/generators/playwright-python';
import { chooseCandidate } from '../src/locators/select';
import { uniqueName, } from '../src/engine/naming';
import { emptyModel, type ModelElement } from '../src/model';
import { pythonName, snake } from '../src/generators/names';
import type { ElementResult, FrameStep } from '../src/engine/types';
import { REQUIRE_FULL_SUITE } from './required';

// Does the generated Playwright Python actually work?
//
// Its TypeScript sibling is resolved against a real browser on every change,
// and the Python spelling is asserted to be that one's mechanical transform —
// but the transform itself was never executed. Selenium taught the lesson:
// `get_dom_property` is Java's and C#'s spelling and does not exist in Python,
// and nothing short of running it noticed.
const PORT = 5255;
const VENV_PY = resolve('.test-venv/bin/python');
const ready = existsSync(VENV_PY);

let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('node', [resolve('scripts/serve-fixtures.mjs')], {
    env: { ...process.env, FIXTURES_PORT: String(PORT) },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/login.html`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('fixtures server did not start');
});

test.afterAll(() => server?.kill());

test('the generated Playwright Python resolves every element it describes', async ({ page }) => {
  test.skip(!ready && !REQUIRE_FULL_SUITE, 'run `npm run fetch:test-deps` for the Python venv');
  expect(ready, 'PM_REQUIRE_FULL_SUITE is set but .test-venv is missing').toBe(true);

  // shadow.html included because Playwright's own engines pierce, so the chain
  // this generator emits is not what makes the element reachable — it is what
  // scopes one of two identical components, and nothing but a real run proves
  // it scopes to the right one (SPEC §19).
  const fixtures = ['login.html', 'widgets.html', 'ambiguous.html', 'edgecases.html', 'shadow.html'];
  const failures: string[] = [];
  const exercised = new Set<string>();
  // Counted so a model that quietly stopped containing shadow elements cannot
  // pass this by containing fewer things (SPEC §19).
  let shadowElements = 0;

  for (const fixture of fixtures) {
    const url = `http://localhost:${PORT}/${fixture}`;
    await page.goto(url);
    await page.addScriptTag({ path: resolve('.test-dist/engine.global.js') });

    const results = await page.$$eval('[data-spike]', (els) =>
      els.map((el) => ({
        spikeId: el.getAttribute('data-spike') as string,
        result: (window as unknown as { __spike: { generate: (e: Element) => ElementResult } }).__spike.generate(el),
      }))
    );

    const model = emptyModel('playwright-python');
    const used = new Set<string>();
    const expected: [string, string][] = [];
    for (const { spikeId, result } of results) {
      const name = uniqueName(result.suggestedName, used);
      expected.push([name, spikeId]);
      model.elements.push({
        ...result,
        id: spikeId,
        name,
        selectedIndex: chooseCandidate(result.candidates, 'playwright-python'),
      } as ModelElement);
    }
    for (const el of model.elements) exercised.add(el.candidates[el.selectedIndex].candidate.kind);
    shadowElements += model.elements.filter((el) => (el.shadowPath?.length ?? 0) > 0).length;

    const out = runInPython(generatePlaywrightPythonPageObject(model), expected, url);
    if (out.trim()) failures.push(`${fixture}\n${out.trim()}`);

    // Again on xpath, which nothing selects on its own — role or better always
    // wins — so `locator("xpath=…")` would otherwise never run. It is the one
    // spelling with a prefix that Playwright does not infer.
    const asXpath = { ...model, elements: [] as ModelElement[] };
    const xpathExpected: [string, string][] = [];
    for (const [i, el] of model.elements.entries()) {
      const at = el.candidates.findIndex((c) => c.candidate.kind === 'xpath');
      if (at === -1) continue;
      asXpath.elements.push({ ...el, selectedIndex: at });
      xpathExpected.push(expected[i]);
    }
    for (const el of asXpath.elements) exercised.add('xpath');
    const xpathOut = runInPython(generatePlaywrightPythonPageObject(asXpath), xpathExpected, url);
    if (xpathOut.trim()) failures.push(`${fixture} (forced xpath)\n${xpathOut.trim()}`);
  }

  expect(failures.join('\n\n'), 'generated Playwright Python did not resolve as promised').toBe('');
  expect(shadowElements, 'elements reached through a shadow root').toBeGreaterThan(4);

  // What this actually proved, so "verified" cannot quietly come to mean less.
  expect([...exercised].sort(), 'locator types exercised against a real browser').toEqual([
    'css',
    'label',
    'placeholder',
    'role',
    'testId',
    'text',
    'xpath',
  ]);
  // Not reached: altText and title. Both are also the element's accessible
  // name, so role wins ahead of them (SPEC §7) and nothing in the fixtures
  // falls through — the same reason Selenium never reaches className.
});

test('the generated Playwright Python chains frameLocator (SPEC §16)', async () => {
  test.skip(!ready && !REQUIRE_FULL_SUITE, 'run `npm run fetch:test-deps` for the Python venv');
  expect(ready, 'PM_REQUIRE_FULL_SUITE is set but .test-venv is missing').toBe(true);

  const url = `http://localhost:${PORT}/frames.html`;
  const model = emptyModel('playwright-python');
  const cases: [string, string, string[]][] = [
    ['ChildEmail', 'child-email', ['#same-frame']],
    ['DeepCvv', 'deep-cvv', ['#same-frame', '#deep-frame']],
    ['CrossEmail', 'child-email', ['#cross-frame']],
    ['CrossDeepCvv', 'deep-cvv', ['#cross-frame', '#deep-frame']],
    ['SrcdocCoupon', 'srcdoc-coupon', ['#srcdoc-frame']],
  ];
  for (const [name, spikeId, chain] of cases) {
    model.elements.push({
      id: name,
      name,
      tag: 'input',
      role: 'textbox',
      accessibleName: null,
      suggestedName: name,
      candidates: [{ candidate: { kind: 'css', value: `[data-spike="${spikeId}"]` }, predictedCount: 1 }],
      preferredIndex: 0,
      selectedIndex: 0,
      framePath: chain.map((value) => ({ frame: { kind: 'css', value } })) as FrameStep[],
    } as ModelElement);
  }

  const out = runInPython(
    generatePlaywrightPythonPageObject(model),
    cases.map(([name, spikeId]) => [name, spikeId] as [string, string]),
    url
  );
  expect(out.trim(), 'generated frame chaining did not resolve').toBe('');
});

/**
 * Import the generated page object into a real Playwright Python run and check
 * every locator lands on the element it was generated from.
 */
function runInPython(generated: string, expected: [string, string][], url: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pm-pw-python-'));
  const file = join(dir, 'check.py');

  const source = [
    'import sys',
    'from playwright.sync_api import sync_playwright',
    '',
    // The generated module, verbatim — its own imports included, so a wrong
    // one is a failure here too.
    generated,
    '',
    'failures = []',
    'with sync_playwright() as p:',
    '    browser = p.chromium.launch()',
    '    page = browser.new_page()',
    `    page.goto(${JSON.stringify(url)})`,
    '    model = ' + className(generated) + '(page)',
    ...expected.flatMap(([name, spikeId]) => [
      '    try:',
      `        found = model.${pythonName(snake(name))}`,
      '        count = found.count()',
      '        if count != 1:',
      `            failures.append("${name}: matched " + str(count) + ", wanted 1")`,
      '        else:',
      `            actual = found.get_attribute("data-spike")`,
      `            if actual != ${JSON.stringify(spikeId)}:`,
      `                failures.append("${name}: found " + str(actual) + ", wanted ${spikeId}")`,
      '    except Exception as e:',
      `        failures.append("${name}: " + type(e).__name__ + " " + str(e).split(chr(10))[0])`,
    ]),
    '    browser.close()',
    '',
    'print("\\n".join(failures))',
    'sys.exit(0)',
  ].join('\n');

  writeFileSync(file, source);
  try {
    return execFileSync(VENV_PY, [file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return `harness failed:\n${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
}

/** The class the generator named, so the harness instantiates the right one. */
function className(generated: string): string {
  return generated.match(/^class (\w+):/m)?.[1] ?? 'GeneratedPage';
}
