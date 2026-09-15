import { describe, it, expect } from 'vitest';
import {
  generatePlaywrightPythonPageObject,
  generatePlaywrightPythonLocators,
} from '../../src/generators/playwright-python';
import { emptyModel } from '../../src/model';
import { modelOf, type TestElement } from './fixtures/model';

const email: TestElement = {
  name: 'EmailAddress',
  role: 'textbox',
  tag: 'input',
  candidate: { kind: 'label', text: 'Email address', exact: true },
};
const signIn: TestElement = {
  name: 'SignIn',
  role: 'button',
  tag: 'button',
  candidate: { kind: 'role', role: 'button', name: 'Sign in', exact: true },
};
const model = (...els: TestElement[]) => modelOf('playwright-python', ...els);

describe('generatePlaywrightPythonPageObject', () => {
  it('binds annotated locators in __init__', () => {
    expect(generatePlaywrightPythonPageObject(model(email, signIn))).toBe(
      [
        'from playwright.sync_api import Locator, Page',
        '',
        '',
        'class LoginPage:',
        '    def __init__(self, page: Page) -> None:',
        '        self.page = page',
        '        self.email_address: Locator = page.get_by_label("Email address", exact=True)',
        '        self.sign_in: Locator = page.get_by_role("button", name="Sign in", exact=True)',
        '',
      ].join('\n')
    );
  });

  it('wraps no actions, exactly as the TypeScript one does not', () => {
    const out = generatePlaywrightPythonPageObject(model(email, signIn));
    expect(out).not.toContain('def click');
    expect(out).not.toContain('def set_');
  });

  it('drops the Locator import when there is nothing to annotate', () => {
    expect(generatePlaywrightPythonPageObject(emptyModel('playwright-python'))).toBe(
      [
        'from playwright.sync_api import Page',
        '',
        '',
        'class GeneratedPage:',
        '    def __init__(self, page: Page) -> None:',
        '        self.page = page',
        '',
      ].join('\n')
    );
  });
});

describe('generatePlaywrightPythonLocators', () => {
  it('emits bare snake_case assignments', () => {
    expect(generatePlaywrightPythonLocators(model(email, signIn))).toBe(
      [
        'email_address = page.get_by_label("Email address", exact=True)',
        'sign_in = page.get_by_role("button", name="Sign in", exact=True)',
      ].join('\n')
    );
  });

  it('prefixes an xpath, which Playwright will not infer', () => {
    const out = generatePlaywrightPythonLocators(
      model({ name: 'Row', role: null, tag: 'div', candidate: { kind: 'xpath', value: '/html[1]/body[1]/div[2]' } })
    );
    expect(out).toBe('row = page.locator("xpath=/html[1]/body[1]/div[2]")');
  });

  it('emits nothing for an empty model', () => {
    expect(generatePlaywrightPythonLocators(emptyModel('playwright-python'))).toBe('');
  });
});
