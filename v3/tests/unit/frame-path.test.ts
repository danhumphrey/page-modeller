import { describe, it, expect } from 'vitest';
import { generatePlaywrightPageObject, generatePlaywrightLocators } from '../../src/generators/playwright-ts';
import { generatePlaywrightPythonLocators } from '../../src/generators/playwright-python';
import { generatePuppeteerLocators } from '../../src/generators/puppeteer';
import { generateSeleniumJavaLocators, generateSeleniumJava } from '../../src/generators/selenium-java';
import { generateSeleniumPythonLocators } from '../../src/generators/selenium-python';
import { displayElementLocator } from '../../src/locators/display';
import type { FrameStep } from '../../src/engine/types';
import { modelOf, type TestElement } from './fixtures/model';

const PATH: FrameStep[] = [
  { frame: { kind: 'css', value: '#same-frame' } },
  { frame: { kind: 'css', value: '#deep-frame' } },
];
const OPAQUE: FrameStep[] = [{ frame: { kind: 'css', value: ':root' }, opaque: true }];

const framed = (framePath: FrameStep[], candidate: TestElement['candidate']): TestElement => ({
  name: 'Submit',
  role: 'button',
  tag: 'button',
  framePath,
  candidate,
});
const pwSubmit = { kind: 'role', role: 'button', name: 'Submit', exact: true } as const;
const cssSubmit = { kind: 'css', value: 'button' } as const;
const idSubmit = { kind: 'id', value: 'go' } as const;

describe('Playwright carries the chain inside the locator', () => {
  it('chains frameLocator, outermost first', () => {
    expect(generatePlaywrightLocators(modelOf('playwright-ts', framed(PATH, pwSubmit)))).toBe(
      "const submit = page.frameLocator('#same-frame').frameLocator('#deep-frame')" +
        ".getByRole('button', { name: 'Submit', exact: true });"
    );
  });

  it('does the same inside a page object, and adds no comment', () => {
    const out = generatePlaywrightPageObject(modelOf('playwright-ts', framed(PATH, pwSubmit)));
    expect(out).toContain("this.submit = page.frameLocator('#same-frame').frameLocator('#deep-frame').getByRole(");
    // Self-contained: nothing to explain, so nothing is explained.
    expect(out).not.toContain('//');
  });

  it('spells it the Python way', () => {
    expect(generatePlaywrightPythonLocators(modelOf('playwright-python', framed(PATH, pwSubmit)))).toBe(
      'submit = page.frame_locator("#same-frame").frame_locator("#deep-frame")' +
        '.get_by_role("button", name="Submit", exact=True)'
    );
  });

  it('leaves a main-frame element exactly as it was', () => {
    expect(generatePlaywrightLocators(modelOf('playwright-ts', framed([], pwSubmit)))).toBe(
      "const submit = page.getByRole('button', { name: 'Submit', exact: true });"
    );
  });
});

describe('the targets that cannot carry it say so', () => {
  it('warns in Selenium, where a By is frame-agnostic', () => {
    const out = generateSeleniumJavaLocators(modelOf('selenium-java', framed(PATH, idSubmit)));
    expect(out).toBe(
      [
        '// In frame: #same-frame › #deep-frame',
        '// Switch to it before using this locator.',
        'private final By submit = By.id("go");',
      ].join('\n')
    );
  });

  it('puts it in the banner for the methods shape', () => {
    const out = generateSeleniumJava(modelOf('selenium-java', framed(PATH, idSubmit)));
    expect(out).toContain(' * Submit\n * In frame: #same-frame › #deep-frame');
  });

  it('uses a hash comment in Python', () => {
    expect(generateSeleniumPythonLocators(modelOf('selenium-python', framed(PATH, idSubmit)))).toContain(
      '# In frame: #same-frame › #deep-frame'
    );
  });

  it('warns in Puppeteer, which is page-scoped', () => {
    const out = generatePuppeteerLocators(modelOf('puppeteer', framed(PATH, cssSubmit)));
    expect(out).toContain('// In frame: #same-frame › #deep-frame');
    expect(out).toContain("const submit = page.locator('button');");
  });

  it('says nothing at all for a main-frame element', () => {
    expect(generateSeleniumJavaLocators(modelOf('selenium-java', framed([], idSubmit)))).toBe(
      'private final By submit = By.id("go");'
    );
  });
});

describe('an incomplete chain is declared, not hidden', () => {
  it('names the cross-origin break', () => {
    const out = generateSeleniumJavaLocators(modelOf('selenium-java', framed(OPAQUE, idSubmit)));
    expect(out).toContain('a frame above this one is cross-origin');
  });
});

describe('the table shows the chain', () => {
  it('as the expression for Playwright, as a prefix elsewhere', () => {
    expect(displayElementLocator(pwSubmit, 'playwright-ts', PATH)).toBe(
      "frameLocator('#same-frame').frameLocator('#deep-frame').getByRole('button', { name: 'Submit', exact: true })"
    );
    // Two rows that differ only by frame must not read identically — the bug
    // that started this: SubmitButton and SubmitButton2, same text, one wrong.
    expect(displayElementLocator(idSubmit, 'selenium-java', PATH)).toBe('#same-frame › #deep-frame › id: go');
    expect(displayElementLocator(idSubmit, 'selenium-java', [])).toBe('id: go');
  });
});
