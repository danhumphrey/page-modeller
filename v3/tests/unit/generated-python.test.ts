import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { generatePlaywrightPythonPageObject, generatePlaywrightPythonLocators } from '../../src/generators/playwright-python';
import { generateSeleniumPython, generateSeleniumPythonLocators, generateSeleniumPythonPageObject } from '../../src/generators/selenium-python';
import { playwrightExpr, playwrightPyExpr } from '../../src/locators/display';
import { frameworkById } from '../../src/frameworks';
import type { LocatorCandidate } from '../../src/engine/types';
import { modelOf, everyTypeFor, ALL_BUCKETS } from './fixtures/model';

const hasPython = (() => {
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/** Hand the source to Python's own parser. Syntax errors come back as errors. */
function parses(source: string): true | string {
  try {
    execFileSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
      input: source,
      stdio: ['pipe', 'ignore', 'pipe'],
      encoding: 'utf8',
    });
    return true;
  } catch (e) {
    const err = e as { stderr?: string };
    return (err.stderr ?? String(e)).trim();
  }
}

// Values that have broken a generator before, or plausibly could: quotes of
// both kinds, a backslash, a newline in an accessible name, and a non-ASCII
// character. Real pages have all of these.
const NASTY = 'He said "hi" \\ it\'s\nthere — ✓';
const shared = [
  { name: 'Pathy', role: null, tag: 'div', candidate: { kind: 'xpath', value: '/html[1]/body[1]/div[2]' } as LocatorCandidate },
  { name: 'Attrish', role: null, tag: 'a', candidate: { kind: 'css', value: `a[href="/x\\"${NASTY}"]` } as LocatorCandidate },
];
// Selection never hands Selenium a role candidate (SPEC §7), so the awkward
// value reaches it through the strategies it does use.
const nastySelenium = [
  ...shared,
  { name: 'Named', role: 'textbox', tag: 'input', candidate: { kind: 'name', value: NASTY } as LocatorCandidate },
  { name: 'Linked', role: 'link', tag: 'a', candidate: { kind: 'linkText', text: NASTY } as LocatorCandidate },
];
const nastyPlaywright = [
  ...shared,
  { name: 'Quoted', role: 'button', tag: 'button', candidate: { kind: 'role', role: 'button', name: NASTY, exact: true } as LocatorCandidate },
  { name: 'Labelled', role: 'textbox', tag: 'input', candidate: { kind: 'label', text: NASTY, exact: true } as LocatorCandidate },
];

/** Every method bucket and every locator type the framework offers. */
const full = (id: string) => modelOf(id, ...ALL_BUCKETS, ...everyTypeFor(id));

describe.skipIf(!hasPython)('the generated Python is Python', () => {
  const cases: Array<[string, string]> = [
    ['playwright page object', generatePlaywrightPythonPageObject(full('playwright-python'))],
    ['playwright page object, empty', generatePlaywrightPythonPageObject(modelOf('playwright-python'))],
    ['playwright locators', generatePlaywrightPythonLocators(full('playwright-python'))],
    ['selenium methods', generateSeleniumPython(full('selenium-python'))],
    ['selenium locators', generateSeleniumPythonLocators(full('selenium-python'))],
    ['selenium page object', generateSeleniumPythonPageObject(full('selenium-python'))],
    ['selenium page object, empty', generateSeleniumPythonPageObject(modelOf('selenium-python'))],
    ['selenium page object, awkward values', generateSeleniumPythonPageObject(modelOf('selenium-python', ...nastySelenium))],
    ['playwright page object, awkward values', generatePlaywrightPythonPageObject(modelOf('playwright-python', ...nastyPlaywright))],
    ['selenium locators, awkward values', generateSeleniumPythonLocators(modelOf('selenium-python', ...nastySelenium))],
    ['selenium methods, awkward values', generateSeleniumPython(modelOf('selenium-python', ...nastySelenium))],
    ['playwright locators, awkward values', generatePlaywrightPythonLocators(modelOf('playwright-python', ...nastyPlaywright))],
  ];

  for (const [what, source] of cases) {
    it(what, () => {
      expect(parses(source), source).toBe(true);
    });
  }
});

// Silence is how an environment-gated test rots. Say it out loud instead — and
// on CI, where python3 is guaranteed, refuse to skip at all.
it('parsed the Python, or says why not', () => {
  if (process.env.PM_REQUIRE_COMPILE_CHECKS === '1') {
    expect(hasPython, 'PM_REQUIRE_COMPILE_CHECKS is set but python3 is missing').toBe(true);
    return;
  }
  if (!hasPython) console.warn('Skipped the Python parse checks: python3 is not installed');
  expect(true).toBe(true);
});

// ---- Playwright Python against the Playwright TypeScript we do verify ----
//
// The TS expression is resolved in a real browser by the fidelity spec. The
// Python one is the same API in snake_case, so proving it is the mechanical
// transform of the TS one inherits that verification — and catches the failure
// that actually threatens it, a wrong method name like get_by_alt for
// getByAltText.
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const method = (expr: string) => expr.slice(0, expr.indexOf('('));
/** Every string literal in the expression, unescaped. */
const literals = (expr: string, quote: "'" | '"') => {
  const re = new RegExp(`${quote}((?:[^${quote}\\\\]|\\\\.)*)${quote}`, 'g');
  return [...expr.matchAll(re)].map((m) => m[1].replace(/\\(.)/g, '$1'));
};

const SAMPLES: Record<string, LocatorCandidate> = {
  testId: { kind: 'testId', value: 'submit' },
  role: { kind: 'role', role: 'button', name: NASTY, exact: true },
  label: { kind: 'label', text: 'Email address', exact: true },
  placeholder: { kind: 'placeholder', text: 'Leave a comment', exact: true },
  text: { kind: 'text', text: 'Create new account', exact: true },
  altText: { kind: 'altText', text: 'Acme logo', exact: true },
  title: { kind: 'title', text: 'Open help', exact: true },
  css: { kind: 'css', value: 'a[href="/x"]' },
  xpath: { kind: 'xpath', value: '/html[1]/body[1]' },
};

describe('the Playwright Python expression tracks the TypeScript one', () => {
  it('covers every type Playwright offers', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...frameworkById('playwright-python').locatorTypes].sort());
  });

  for (const [kind, candidate] of Object.entries(SAMPLES)) {
    it(`${kind}: same method, same arguments`, () => {
      const ts = playwrightExpr(candidate);
      const py = playwrightPyExpr(candidate);
      expect(camel(method(py)), `${py} vs ${ts}`).toBe(method(ts));
      expect(literals(py, '"')).toEqual(literals(ts, "'"));
    });
  }

  it('says exact the Python way', () => {
    expect(playwrightPyExpr(SAMPLES.label)).toContain('exact=True');
    expect(playwrightPyExpr({ kind: 'label', text: 'Email' })).not.toContain('exact');
  });
});
