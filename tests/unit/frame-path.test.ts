import { describe, it, expect } from 'vitest';
import { generatePlaywrightPageObject, generatePlaywrightLocators } from '../../src/generators/playwright-ts';
import { generatePlaywrightPythonLocators } from '../../src/generators/playwright-python';
import { generatePuppeteerLocators } from '../../src/generators/puppeteer';
import { generateSeleniumJavaLocators, generateSeleniumJava } from '../../src/generators/selenium-java';
import { generateSeleniumCSharpLocators } from '../../src/generators/selenium-csharp';
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
  it('gives Selenium the switch itself, ready to paste', () => {
    // Not an instruction to go and write one — the reader can uncomment this.
    const out = generateSeleniumJavaLocators(modelOf('selenium-java', framed(PATH, idSubmit)));
    expect(out).toBe(
      [
        '// In frame: #same-frame › #deep-frame',
        '// driver.switchTo().defaultContent();',
        '// driver.switchTo().frame(driver.findElement(By.cssSelector("#same-frame")));',
        '// driver.switchTo().frame(driver.findElement(By.cssSelector("#deep-frame")));',
        'private final By submit = By.id("go");',
      ].join('\n')
    );
  });

  it('spells the switch each language’s own way', () => {
    expect(generateSeleniumCSharpLocators(modelOf('selenium-csharp', framed(PATH, idSubmit)))).toContain(
      '// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));'
    );
    expect(generateSeleniumPythonLocators(modelOf('selenium-python', framed(PATH, idSubmit)))).toContain(
      '# driver.switch_to.frame(driver.find_element(By.CSS_SELECTOR, "#same-frame"))'
    );
    // Puppeteer has no switch: it walks down to the frame and hands you a new
    // scope to use in place of `page`.
    const pup = generatePuppeteerLocators(modelOf('puppeteer', framed(PATH, cssSubmit)));
    expect(pup).toContain("// const frame1 = await (await page.$('#same-frame')).contentFrame();");
    expect(pup).toContain("// const frame2 = await (await frame1.$('#deep-frame')).contentFrame();");
    expect(pup).toContain('// Then use frame2.locator(...) in place of page.locator(...).');
  });

  it('puts the frame in the banner as context, not as a switch to paste', () => {
    // The methods below switch for themselves, so repeating it in the banner
    // is noise the reader has to check against the code under it.
    const out = generateSeleniumJava(modelOf('selenium-java', framed(PATH, idSubmit)));
    expect(out).toContain(' * Submit\n * In frame: #same-frame › #deep-frame');
    expect(out).not.toContain(' * driver.switchTo()');
  });

  it('makes each framed method switch in and out on its own', () => {
    const out = generateSeleniumJava(modelOf('selenium-java', framed(PATH, idSubmit)));
    expect(out).toBe(
      [
        '/*',
        ' * Submit',
        ' * In frame: #same-frame › #deep-frame',
        ' * ***************************************************************',
        ' */',
        '',
        'public void clickSubmit() {',
        '    driver.switchTo().defaultContent();',
        '    driver.switchTo().frame(driver.findElement(By.cssSelector("#same-frame")));',
        '    driver.switchTo().frame(driver.findElement(By.cssSelector("#deep-frame")));',
        '    try {',
        '        driver.findElement(By.id("go")).click();',
        '    } finally {',
        // Or the next method starts inside this frame. That is what makes
        // generated methods safe to call in any order (SPEC §16).
        '        driver.switchTo().defaultContent();',
        '    }',
        '}',
      ].join('\n')
    );
  });

  it('gives a framed element no element getter', () => {
    // A WebElement goes stale the moment the driver switches away, so handing
    // one back is handing back a guaranteed failure.
    const out = generateSeleniumJava(modelOf('selenium-java', framed(PATH, idSubmit)));
    expect(out).not.toContain('getSubmitElement');
    // Unframed, it is still there.
    expect(generateSeleniumJava(modelOf('selenium-java', framed([], idSubmit)))).toContain(
      'public WebElement getSubmitElement()'
    );
  });

  it('leaves an opaque chain to the caller rather than switching wrongly', () => {
    // Half a chain would switch into the wrong document and look like it worked.
    const out = generateSeleniumJava(modelOf('selenium-java', framed(OPAQUE, idSubmit)));
    expect(out).toContain('switch into it yourself first');
    expect(out).not.toContain('switchTo()');
    expect(out).toContain('public WebElement getSubmitElement()');
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
  it('names the break, and offers no switch to paste', () => {
    const out = generateSeleniumJavaLocators(modelOf('selenium-java', framed(OPAQUE, idSubmit)));
    expect(out).toContain('// A frame above this one is cross-origin, so the chain is incomplete.');
    // Half a chain would switch into the wrong document and look like it worked.
    expect(out).not.toContain('switchTo().frame');
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
