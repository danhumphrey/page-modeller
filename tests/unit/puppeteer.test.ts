import { describe, it, expect } from 'vitest';
import { generatePuppeteerPageObject, generatePuppeteerLocators } from '../../src/generators/puppeteer';
import { emptyModel } from '../../src/model';
import { modelOf, type TestElement } from './fixtures/model';

const signIn: TestElement = { name: 'SignIn', role: 'button', tag: 'button', candidate: { kind: 'css', value: '#go' } };
const row: TestElement = {
  name: 'FirstRow',
  role: null,
  tag: 'div',
  candidate: { kind: 'xpath', value: '/html[1]/body[1]/div[2]' },
};
const model = (...els: TestElement[]) => modelOf('puppeteer', ...els);

describe('generatePuppeteerPageObject', () => {
  it('is the Playwright page object with Puppeteer’s types and selectors', () => {
    expect(generatePuppeteerPageObject(model(signIn, row))).toBe(
      [
        "import { type Locator, type Page } from 'puppeteer';",
        '',
        'export class LoginPage {',
        // Generic: `page.locator('button')` yields a Locator<HTMLButtonElement>.
        '  readonly signIn: Locator<Element>;',
        '  readonly firstRow: Locator<Element>;',
        '',
        '  constructor(private readonly page: Page) {',
        "    this.signIn = page.locator('#go');",
        // The doubled slash is right: `xpath/` prefix + an absolute path.
        "    this.firstRow = page.locator('xpath//html[1]/body[1]/div[2]');",
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('imports from puppeteer, not @playwright/test', () => {
    const out = generatePuppeteerPageObject(model(signIn));
    expect(out).toContain("from 'puppeteer'");
    expect(out).not.toContain('playwright');
  });

  it('still emits a usable class for an empty model', () => {
    expect(generatePuppeteerPageObject(emptyModel('puppeteer'))).toBe(
      [
        "import { type Page } from 'puppeteer';",
        '',
        'export class GeneratedPage {',
        '  constructor(private readonly page: Page) {}',
        '}',
        '',
      ].join('\n')
    );
  });
});

describe('generatePuppeteerLocators', () => {
  it('emits bare consts', () => {
    expect(generatePuppeteerLocators(model(signIn))).toBe("const signIn = page.locator('#go');");
  });

  it('emits nothing for an empty model', () => {
    expect(generatePuppeteerLocators(emptyModel('puppeteer'))).toBe('');
  });
});
