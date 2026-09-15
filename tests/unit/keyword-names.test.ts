import { describe, it, expect } from 'vitest';
import { generatePlaywrightPythonPageObject, generatePlaywrightPythonLocators } from '../../src/generators/playwright-python';
import { generatePlaywrightLocators } from '../../src/generators/playwright-ts';
import { generateSeleniumJavaLocators, generateSeleniumJava } from '../../src/generators/selenium-java';
import { modelOf, type TestElement } from './fixtures/model';

// Element names come from the page, and pages have buttons called Continue.
const kw = (name: string): TestElement => ({
  name,
  role: 'button',
  tag: 'button',
  candidate: { kind: 'css', value: 'button' },
});

describe('a name that is a keyword somewhere', () => {
  it('is suffixed in Python, where it would not parse', () => {
    const out = generatePlaywrightPythonPageObject(modelOf('playwright-python', kw('Continue'), kw('Class')));
    expect(out).toContain('self.continue_: Locator =');
    expect(out).toContain('self.class_: Locator =');
    expect(generatePlaywrightPythonLocators(modelOf('playwright-python', kw('Import')))).toContain('import_ = page.');
  });

  it('is suffixed in a JavaScript const, where it would not parse either', () => {
    // The page-object field form is legal — `this.continue` is fine — but the
    // locators shape declares variables, and `const continue` is not.
    expect(generatePlaywrightLocators(modelOf('playwright-ts', kw('Continue')))).toContain('const continue_ =');
  });

  it('is suffixed in a Java field', () => {
    expect(generateSeleniumJavaLocators(modelOf('selenium-java', kw('Continue')))).toContain(
      'private final By continue_ ='
    );
  });

  it('does not collide with a method Object already has', () => {
    // `getClass()` cannot be declared, whatever the element is called.
    const out = generateSeleniumJava(modelOf('selenium-java', { ...kw('Class'), role: 'heading', tag: 'h1' }));
    expect(out).toContain('public String getClass_()');
    expect(out).toContain('public WebElement getClassElement()');
  });

  it('leaves an ordinary name alone', () => {
    expect(generatePlaywrightPythonLocators(modelOf('playwright-python', kw('SignIn')))).toContain('sign_in = page.');
    expect(generateSeleniumJavaLocators(modelOf('selenium-java', kw('SignIn')))).toContain('By signIn =');
  });
});
