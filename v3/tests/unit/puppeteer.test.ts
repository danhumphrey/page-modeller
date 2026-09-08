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
  it('binds page.locator in the constructor — plain JS, no types', () => {
    expect(generatePuppeteerPageObject(model(signIn, row))).toBe(
      [
        'export class LoginPage {',
        '  constructor(page) {',
        '    this.page = page;',
        "    this.signIn = page.locator('#go');",
        // The doubled slash is right: `xpath/` prefix + an absolute path.
        "    this.firstRow = page.locator('xpath//html[1]/body[1]/div[2]');",
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('still emits a usable class for an empty model', () => {
    const out = generatePuppeteerPageObject(emptyModel('puppeteer'));
    expect(out).toContain('export class GeneratedPage {');
    expect(out).toContain('this.page = page;');
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
