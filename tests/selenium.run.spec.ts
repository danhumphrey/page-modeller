import { test, expect } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { generateSeleniumPython } from '../src/generators/selenium-python';
import { chooseCandidate } from '../src/locators/select';
import { uniqueName } from '../src/engine/naming';
import { activeCandidate, emptyModel, type ModelElement } from '../src/model';
import { classify, isImage } from '../src/generators/classify';
import type { ElementResult } from '../src/engine/types';
import { REQUIRE_FULL_SUITE } from './required';

// Does the generated Selenium actually WORK?
//
// Everything else about these targets is compiled or parsed, never run: the
// compile checks prove `Select` and `get_dom_property` exist, not that the
// locator finds the element or that the frame switch lands in the right
// document (CLAUDE.md, "What is verified per target").
//
// Python because it is the only Selenium runtime that installs without a
// toolchain, and because the part most likely to be wrong — WHICH strategy is
// chosen — is shared by all three languages through `selenium.ts`. What Java
// and C# have that Python does not is spelling, and that the compilers check.
const PORT = 5266;
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

test('the generated Selenium finds every element it describes', async ({ page }) => {
  test.skip(!ready && !REQUIRE_FULL_SUITE, 'run `npm run fetch:test-deps` for the Python venv');
  expect(ready, 'PM_REQUIRE_FULL_SUITE is set but .test-venv is missing').toBe(true);

  const fixtures = ['login.html', 'widgets.html', 'ambiguous.html', 'edgecases.html'];
  const failures: string[] = [];
  const exercised = new Set<string>();

  for (const fixture of fixtures) {
    const url = `http://localhost:${PORT}/${fixture}`;
    await page.goto(url);
    await page.addScriptTag({ path: resolve('.test-dist/engine.global.js') });

    // The same engine the extension runs, on the same tagged elements the
    // fidelity spec uses — so this checks the generator, not the engine.
    const results = await page.$$eval('[data-spike]', (els) =>
      els.map((el) => ({
        spikeId: el.getAttribute('data-spike') as string,
        result: (window as unknown as { __spike: { generate: (e: Element) => ElementResult } }).__spike.generate(el),
      }))
    );

    const model = emptyModel('selenium-python');
    const used = new Set<string>();
    const expected = new Map<string, string>();
    for (const { spikeId, result } of results) {
      const name = uniqueName(result.suggestedName, used);
      expected.set(name, spikeId);
      model.elements.push({
        ...result,
        id: spikeId,
        name,
        selectedIndex: chooseCandidate(result.candidates, 'selenium-python'),
      } as ModelElement);
    }

    for (const el of model.elements) exercised.add(activeCandidate(el).kind);

    const out = runInSelenium(generateSeleniumPython(model), [...expected], url, 'getter', model.elements);
    if (out.trim()) failures.push(`${fixture}\n${out.trim()}`);

    // Again on xpath. Nothing in the fixtures selects it — css or better always
    // wins — so the universal fallback, and `By.XPATH`, would otherwise never
    // be run at all. The Edit dialog lets anyone choose it, so it has to work.
    const asXpath = { ...model, elements: [] as ModelElement[] };
    for (const el of model.elements) {
      const i = el.candidates.findIndex((c) => c.candidate.kind === 'xpath');
      if (i === -1) continue;
      asXpath.elements.push({ ...el, selectedIndex: i });
    }
    for (const el of asXpath.elements) exercised.add(activeCandidate(el).kind);
    const xpathOut = runInSelenium(
      generateSeleniumPython(asXpath),
      asXpath.elements.map((el) => [el.name, expected.get(el.name)!] as [string, string]),
      url
    );
    if (xpathOut.trim()) failures.push(`${fixture} (forced xpath)\n${xpathOut.trim()}`);
  }

  expect(failures.join('\n\n'), 'generated Selenium did not resolve as promised').toBe('');

  // Which strategies this actually proved. Selenium ranks className and
  // tagName last and nothing in the fixtures reaches them, so breaking those
  // would not fail this — better said than assumed.
  expect([...exercised].sort(), 'strategies exercised against a real driver').toEqual([
    'css',
    'id',
    'linkText',
    'name',
    'xpath',
  ]);
  // className, tagName and partialLinkText rank below css in Selenium's order
  // (SPEC §11) and nothing reaches them, so breaking those would not fail this.
});

test('the generated Selenium moves a slider to the value asked for', async ({ page }) => {
  test.skip(!ready && !REQUIRE_FULL_SUITE, 'run `npm run fetch:test-deps` for the Python venv');
  expect(ready, 'PM_REQUIRE_FULL_SUITE is set but .test-venv is missing').toBe(true);

  // A range is not a text field, whatever its value looks like. Selenium's
  // text setter calls clear(), which moves a range to the MIDDLE of its span
  // and says nothing, then send_keys, which does nothing — so it lands on a
  // number nobody asked for and reports success. Hence its own bucket, driven
  // by the keyboard, and hence this: the only way to know it works is to watch
  // the value change.
  const url = `http://localhost:${PORT}/widgets.html`;
  await page.goto(url);
  await page.addScriptTag({ path: resolve('.test-dist/engine.global.js') });

  const result = await page.$eval(
    '[data-spike="volume-slider"]',
    (el) => (window as unknown as { __spike: { generate: (e: Element) => ElementResult } }).__spike.generate(el)
  );
  expect(result.role, 'the fixture really is a slider').toBe('slider');

  const model = emptyModel('selenium-python');
  model.elements.push({
    ...result,
    id: 'volume-slider',
    name: 'Volume',
    selectedIndex: chooseCandidate(result.candidates, 'selenium-python'),
  } as ModelElement);

  const out = runInPythonSlider(generateSeleniumPython(model), url);
  expect(out.trim(), 'the generated slider methods did not behave').toBe('');
});

test('the generated Selenium switches into frames and back out (SPEC §16)', async ({ page }) => {
  test.skip(!ready && !REQUIRE_FULL_SUITE, 'run `npm run fetch:test-deps` for the Python venv');
  expect(ready, 'PM_REQUIRE_FULL_SUITE is set but .test-venv is missing').toBe(true);

  const url = `http://localhost:${PORT}/frames.html`;
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  // Elements inside the frames, with the chain the extension would record. Not
  // taken from the engine here: the engine runs per document and only the
  // extension's own frame-path push assembles the chain, which is a browser
  // mechanism this harness has no part in.
  const model = emptyModel('selenium-python');
  const cases: [string, string, string[]][] = [
    ['ChildEmail', 'child-email', ['#same-frame']],
    ['DeepCvv', 'deep-cvv', ['#same-frame', '#deep-frame']],
    ['CrossEmail', 'child-email', ['#cross-frame']],
    ['CrossDeepCvv', 'deep-cvv', ['#cross-frame', '#deep-frame']],
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
      framePath: chain.map((value) => ({ frame: { kind: 'css', value } })),
    } as ModelElement);
  }

  // A framed element gets no element getter — a WebElement goes stale the
  // moment the driver switches away (SPEC §16) — so the read method is what
  // there is to call. It has to switch in, find, and switch back, and the next
  // call has to work: if any of them left the driver inside a frame, the one
  // after would fail.
  const out = runInSelenium(
    generateSeleniumPython(model),
    model.elements.map((el) => [el.name, ''] as [string, string]),
    url,
    'read'
  );
  expect(out.trim(), 'generated frame switching did not resolve').toBe('');
});

/**
 * Run the generated module against a real browser and return whatever went
 * wrong, empty for success.
 *
 * The generated functions reference a bare `driver`, exactly as the Methods
 * shape says they do (SPEC §11), so the harness simply defines one.
 */
/**
 * The bucket's own read method, or null where reading has a side effect.
 *
 * Calling these is what proves the method BODIES work, not just the locators —
 * and it is how `get_dom_property`, a method Python does not have, was found.
 */
function readCall(el: ModelElement, snake: (s: string) => string): string | null {
  const n = snake(el.name);
  switch (classify(el)) {
    case 'text':
      return `get_${n}()`;
    case 'toggle':
      return `is_${n}_checked()`;
    case 'radio':
      return `is_${n}_selected()`;
    case 'select':
      return `get_${n}_text()`;
    case 'multiSelect':
      return `get_${n}_texts()`;
    case 'slider':
      return `get_${n}()`;
    case 'static':
      return isImage(el) ? `get_${n}_alt_text()` : `get_${n}()`;
    // Clicking is the only thing an actionable element offers, and it navigates.
    case 'actionable':
      return null;
  }
}

function runInSelenium(
  generated: string,
  expected: [string, string][],
  url: string,
  mode: 'getter' | 'read' = 'getter',
  elements: ModelElement[] = []
): string {
  const dir = mkdtempSync(join(tmpdir(), 'pm-selenium-'));
  const file = join(dir, 'check.py');
  const snake = (name: string) =>
    (name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z0-9]+|[0-9]+/g) ?? [name]).map((w) => w.toLowerCase()).join('_');

  /** The bucket's read method, called for its exceptions rather than its value. */
  const readLines = (name: string) => {
    const el = elements.find((e) => e.name === name);
    const call = el ? readCall(el, snake) : null;
    return call ? [`        ${call}`] : [];
  };

  const source = [
    'import sys',
    'from selenium import webdriver',
    'from selenium.webdriver.chrome.options import Options',
    'from selenium.webdriver.common.by import By',
    'from selenium.webdriver.support.ui import Select',
    '',
    'options = Options()',
    'options.add_argument("--headless=new")',
    'options.add_argument("--no-sandbox")',
    // Whatever Chrome the environment provides, driver and browser together.
    //
    // Pinning Playwright's chromium here looked tidier and broke CI: the runner
    // has a chromedriver on PATH, Selenium Manager prefers it over downloading
    // one, and it refused to drive a browser two majors older. Left alone,
    // Selenium Manager matches the pair — and downloads Chrome for Testing when
    // there is none, so this still needs nothing installed.
    'driver = webdriver.Chrome(options=options)',
    'failures = []',
    'try:',
    `    driver.get(${JSON.stringify(url)})`,
    '',
    // The generated module, verbatim, indented into the try block.
    ...generated.split('\n').map((line) => (line ? `    ${line}` : line)),
    '',
    ...expected.flatMap(([name, spikeId]) =>
      mode === 'getter'
        ? [
            '    try:',
            `        found = get_${snake(name)}_element()`,
            `        actual = found.get_dom_attribute("data-spike")`,
            `        if actual != ${JSON.stringify(spikeId)}:`,
            `            failures.append("${name}: found " + str(actual) + ", wanted ${spikeId}")`,
            ...readLines(name),
            '    except Exception as e:',
            `        failures.append("${name}: " + type(e).__name__ + " " + str(e).split(chr(10))[0])`,
          ]
        : [
            '    try:',
            // Reading the value is enough: it can only be read from inside the
            // right document, and it raises if the switch went wrong.
            `        get_${snake(name)}()`,
            '    except Exception as e:',
            `        failures.append("${name}: " + type(e).__name__ + " " + str(e).split(chr(10))[0])`,
          ]
    ),
    'finally:',
    '    driver.quit()',
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

/**
 * Drive the generated slider methods and report anything that did not do what
 * it says. Its own harness because a slider is the one bucket whose methods
 * are only meaningful by their effect.
 */
function runInPythonSlider(generated: string, url: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pm-slider-'));
  const file = join(dir, 'check.py');
  const source = [
    'import sys',
    'from selenium import webdriver',
    'from selenium.webdriver.chrome.options import Options',
    'from selenium.webdriver.common.by import By',
    'from selenium.webdriver.common.keys import Keys',
    'from selenium.webdriver.support.ui import Select',
    '',
    'options = Options()',
    'options.add_argument("--headless=new")',
    'options.add_argument("--no-sandbox")',
    'driver = webdriver.Chrome(options=options)',
    'failures = []',
    'def check(what, actual, wanted):',
    '    if str(actual) != str(wanted):',
    '        failures.append(what + ": " + str(actual) + ", wanted " + str(wanted))',
    'try:',
    `    driver.get(${JSON.stringify(url)})`,
    '',
    ...generated.split('\n').map((line) => (line ? `    ${line}` : line)),
    '',
    // The fixture is min 0, max 10, step 1, starting at 3.
    '    check("initial", get_volume(), 3)',
    '    increment_volume()',
    '    check("after increment", get_volume(), 4)',
    '    decrement_volume()',
    '    check("after decrement", get_volume(), 3)',
    '    set_volume_to_max()',
    '    check("after to_max", get_volume(), 10)',
    '    set_volume_to_min()',
    '    check("after to_min", get_volume(), 0)',
    // Upwards, downwards, and a target it is already on.
    '    set_volume("7")',
    '    check("set to 7 from 0", get_volume(), 7)',
    '    set_volume("2")',
    '    check("set to 2 from 7", get_volume(), 2)',
    '    set_volume("2")',
    '    check("set to 2 again", get_volume(), 2)',
    // Beyond the end: it clamps rather than looping forever.
    '    set_volume("99")',
    '    check("set beyond max", get_volume(), 10)',
    'finally:',
    '    driver.quit()',
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
