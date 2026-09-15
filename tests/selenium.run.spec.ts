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

  // shadow.html included because the host chain is the part of the generator
  // that no compiler and no parser can check: `getShadowRoot()` exists whether
  // or not the chain it is built from lands in the right tree (SPEC §19).
  const fixtures = ['login.html', 'widgets.html', 'ambiguous.html', 'edgecases.html', 'shadow.html'];
  const failures: string[] = [];
  const exercised = new Set<string>();
  // How many of the elements run here were reached through a shadow root. The
  // suite would pass just as happily if none were — which is the whole risk
  // with a fixture whose interesting content is invisible to an ordinary tree
  // walk (SPEC §19).
  let shadowElements = 0;
  let deepestChain = 0;
  // Setters actually executed against the driver. Counted because the writes
  // are guarded on the element being interactable, and a guard that turned out
  // to skip everything would leave this suite green on nothing.
  let settersRun = 0;

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
    for (const el of model.elements) {
      const depth = el.shadowPath?.length ?? 0;
      if (depth > 0) shadowElements++;
      deepestChain = Math.max(deepestChain, depth);
    }

    const out = runInSelenium(generateSeleniumPython(model), [...expected], url, 'getter', model.elements);
    const [reported, counted] = splitSetterCount(out);
    settersRun += counted;
    if (reported) failures.push(`${fixture}\n${reported}`);

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
    const [xpathReported] = splitSetterCount(xpathOut);
    if (xpathReported) failures.push(`${fixture} (forced xpath)\n${xpathReported}`);
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

  // And that the shadow chain was genuinely walked, not skipped. An engine
  // change that stopped collecting shadow content would leave every assertion
  // above passing on a smaller model.
  // The setters are where the API surface is widest — `clear()`, `send_keys`,
  // `select_by_visible_text`, `deselect_all` — and where the one bug this suite
  // has caught so far lived: `get_dom_property` is Java's and C#'s spelling and
  // does not exist in Python. Only the readers were ever run.
  expect(settersRun, 'generated setters run against a real driver').toBeGreaterThanOrEqual(20);

  expect(shadowElements, 'elements reached through a shadow root').toBeGreaterThan(4);
  expect(deepestChain, 'deepest host chain walked').toBeGreaterThanOrEqual(2);
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
  expect(splitSetterCount(out)[0], 'generated frame switching did not resolve').toBe('');
});

test('the generated Selenium switches into a frame a component renders (SPEC §16, §19)', async ({ page }) => {
  test.skip(!ready && !REQUIRE_FULL_SUITE, 'run `npm run fetch:test-deps` for the Python venv');
  expect(ready, 'PM_REQUIRE_FULL_SUITE is set but .test-venv is missing').toBe(true);

  // A frame's own selector is located in the tree the frame lives in, and for
  // a frame rendered by a web component that is the component's shadow root.
  // Selenium cannot see in from the document at all — `shadow.probe.spec.ts`
  // measures a document-rooted find as reaching nothing — so the switch has to
  // walk the host chain first. Emitting the bare selector produced a
  // NoSuchElementException on a locator the model called good.
  const url = `http://localhost:${PORT}/shadow.html`;
  await page.goto(url);
  await page.waitForFunction(() => !!document.querySelector('frame-host')?.shadowRoot?.querySelector('iframe'));

  const model = emptyModel('selenium-python');
  model.elements.push({
    id: 'Giftcard',
    name: 'Giftcard',
    tag: 'input',
    role: 'textbox',
    accessibleName: null,
    suggestedName: 'Giftcard',
    candidates: [{ candidate: { kind: 'css', value: '[data-spike="shadow-frame-input"]' }, predictedCount: 1 }],
    preferredIndex: 0,
    selectedIndex: 0,
    framePath: [
      {
        frame: { kind: 'css', value: '#in-shadow' },
        shadowPath: [{ host: { kind: 'css', value: 'frame-host' } }],
      },
    ],
  } as ModelElement);

  const generated = generateSeleniumPython(model);
  // The traversal is in the switch, not merely in a comment above it.
  expect(generated, 'the host chain is walked before the frame is entered').toContain('.shadow_root');

  const out = runInSelenium(generated, [['Giftcard', '']], url, 'read');
  expect(splitSetterCount(out)[0], 'generated frame switching did not resolve').toBe('');
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
/** Peel the setter counter off the runner's output, leaving the failures. */
function splitSetterCount(out: string): [failures: string, count: number] {
  const lines = out.split('\n');
  const i = lines.findIndex((l) => l.startsWith('__setters_run__'));
  if (i === -1) return [out.trim(), 0];
  const count = Number(lines[i].split(' ')[1] ?? 0);
  return [lines.filter((_, n) => n !== i).join('\n').trim(), count];
}

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

/**
 * The bucket's SETTER, and where it is cheap, a check that it did something.
 *
 * Only the read methods were ever executed. The setters are where the API
 * surface is widest — `clear()`, `send_keys`, `Select.select_by_visible_text`,
 * `deselect_all` — and where the one bug this suite has caught so far lived:
 * `get_dom_property` is Java's and C#'s spelling and does not exist in Python,
 * and no compiler or parser could have found it. A setter spelled the same way
 * would still be sitting there.
 *
 * Every value written is one the element already holds or plainly accepts, so
 * nothing here depends on a fixture keeping a particular value.
 */
function writeCall(el: ModelElement, snake: (s: string) => string): string[] {
  const n = snake(el.name);
  const fail = (what: string) => `            failures.append("${el.name}: ${what}")`;
  switch (classify(el)) {
    case 'text':
      // A file input is classified text — `clear()` + `send_keys(path)` is the
      // documented upload idiom — but it takes a PATH, and anything else
      // raises InvalidArgumentException. Nothing is proved by feeding it one.
      if (el.inputType === 'file') return [];
      // `date`, `number`, `color` and friends silently ignore text they do not
      // accept, so the round-trip is only asserted where it means something.
      return el.inputType == null || el.inputType === 'text' || el.inputType === 'search' || el.inputType === 'password'
        ? [`        set_${n}("pm")`, `        if get_${n}() != "pm":`, fail(`set_${n} did not take`)]
        : [`        set_${n}("pm")`];
    case 'toggle':
      // Set it, check it took, and put it back.
      return [
        `        was = is_${n}_checked()`,
        `        set_${n}(not was)`,
        `        if is_${n}_checked() == was:`,
        fail(`set_${n} did not move the control`),
        `        set_${n}(was)`,
      ];
    case 'radio':
      return [`        select_${n}()`, `        if not is_${n}_selected():`, fail(`select_${n} did not select it`)];
    case 'select':
      // Re-selecting what is already selected: the option is guaranteed to
      // exist, so this exercises `select_by_visible_text` without depending on
      // the fixture's contents.
      //
      // The value round-trip is deliberately NOT here. An <option> with no
      // `value` attribute reports its text as its IDL value, and
      // `select_by_value` matches the attribute — so feeding one back to the
      // other fails on valueless options. That is HTML's and Selenium's
      // semantics, not something the generator decides, and asserting it here
      // would only pin the fixture's markup.
      return [`        set_${n}_by_text(get_${n}_text())`];
    case 'multiSelect':
      return [
        `        set_${n}_by_texts(*get_${n}_texts())`,
        `        set_${n}_by_values(*get_${n}_values())`,
        `        deselect_all_${n}()`,
      ];
    case 'slider':
      // Net zero, so the value is where it started for anything read after it.
      return [`        increment_${n}()`, `        decrement_${n}()`, `        set_${n}(get_${n}())`];
    // Nothing to write. Clicking is all an actionable element offers and it
    // navigates, which would take the rest of the run with it.
    case 'actionable':
    case 'static':
      return [];
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
    if (!el) return [];
    const call = readCall(el, snake);
    const writes = writeCall(el, snake);
    return [
      ...(call ? [`        ${call}`] : []),
      // Writing needs an element you could write to. The fixtures carry hidden
      // and disabled controls on purpose, and a page object is not wrong for
      // being unable to type into one — WebDriver raises
      // ElementNotInteractableException, which is the right answer.
      ...(writes.length
        ? [
            '        if found.is_displayed() and found.is_enabled():',
            ...writes.map((line) => `    ${line}`),
            // Counted, so the guard above cannot quietly skip every setter and
            // leave the suite green on nothing.
            `            ran.append(${JSON.stringify(el.name)})`,
          ]
        : []),
    ];
  };

  const source = [
    'import sys',
    'from selenium import webdriver',
    'from selenium.webdriver.chrome.options import Options',
    'from selenium.webdriver.common.by import By',
    'from selenium.webdriver.support.ui import Select',
    // The methods shape emits no imports at all — by design (SPEC §17): it is
    // pasted into a file that has them, and the page-object shape is the one
    // that computes them from the buckets present. So the harness supplies the
    // three a user would: By, Select and Keys.
    'from selenium.webdriver.common.keys import Keys',
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
    'ran = []',
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
    // On its own line, so the caller can count setters run without it reading
    // as a failure.
    'print("__setters_run__ " + str(len(ran)))',
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
