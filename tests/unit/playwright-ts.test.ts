import { describe, it, expect } from 'vitest';
import {
  generatePlaywrightPageObject,
  generatePlaywrightLocators,
} from '../../src/generators/playwright-ts';
import { emptyModel, type ModelElement, type TabModel } from '../../src/model';
import type { LocatorCandidate } from '../../src/engine/types';

function model(...elements: Array<Partial<ModelElement> & { name: string; candidate: LocatorCandidate }>): TabModel {
  const m = emptyModel('playwright-ts');
  m.url = 'https://example.com/account/login.html';
  m.elements = elements.map(({ candidate, ...el }, i) => ({
    id: `el-${i}`,
    tag: 'div',
    role: null,
    accessibleName: null,
    suggestedName: el.name,
    selectedIndex: 0,
    preferredIndex: 0,
    candidates: [{ candidate, predictedCount: 1 }],
    ...el,
  })) as ModelElement[];
  return m;
}

const email: Parameters<typeof model>[0] = {
  name: 'EmailAddress',
  role: 'textbox',
  tag: 'input',
  candidate: { kind: 'label', text: 'Email address', exact: true },
};
const signIn: Parameters<typeof model>[0] = {
  name: 'SignIn',
  role: 'button',
  tag: 'button',
  candidate: { kind: 'role', role: 'button', name: 'Sign in', exact: true },
};

describe('generatePlaywrightPageObject', () => {
  it('names the class from the page URL', () => {
    expect(generatePlaywrightPageObject(model(email))).toContain('export class LoginPage {');
  });

  it('declares readonly fields and assigns them in the constructor', () => {
    const out = generatePlaywrightPageObject(model(email, signIn));
    expect(out).toContain('  readonly emailAddress: Locator;');
    expect(out).toContain('  readonly signIn: Locator;');
    expect(out).toContain('  constructor(private readonly page: Page) {');
    expect(out).toContain("    this.emailAddress = page.getByLabel('Email address', { exact: true });");
    expect(out).toContain(
      "    this.signIn = page.getByRole('button', { name: 'Sign in', exact: true });"
    );
  });

  it('assigns from the constructor parameter, not this.page', () => {
    // `this.page` is not assigned until the parameter property is applied, so
    // reading it in the constructor body is the classic undefined-locator bug.
    expect(generatePlaywrightPageObject(model(email))).not.toContain('this.page.getBy');
  });

  it('imports both types, type-only', () => {
    expect(generatePlaywrightPageObject(model(email))).toContain(
      "import { type Locator, type Page } from '@playwright/test';"
    );
  });

  it('wraps no actions — a Locator is already the action API', () => {
    // The whole point of the reshape: `page.signIn.click()` beats
    // `page.clickSignIn()`. Composite methods are the user's to add.
    const out = generatePlaywrightPageObject(model(email, signIn));
    expect(out).not.toContain('async ');
    expect(out).not.toContain('click');
    expect(out).not.toContain('fill');
  });

  it('emits a usable empty class, with no unused Locator import', () => {
    const out = generatePlaywrightPageObject(emptyModel('playwright-ts'));
    expect(out).toBe(
      [
        "import { type Page } from '@playwright/test';",
        '',
        'export class GeneratedPage {',
        '  constructor(private readonly page: Page) {}',
        '}',
        '',
      ].join('\n')
    );
  });
});

describe('generatePlaywrightLocators', () => {
  it('emits bare consts, with no class around them', () => {
    const out = generatePlaywrightLocators(model(email, signIn));
    expect(out).toBe(
      [
        "const emailAddress = page.getByLabel('Email address', { exact: true });",
        "const signIn = page.getByRole('button', { name: 'Sign in', exact: true });",
      ].join('\n')
    );
  });

  it('emits nothing for an empty model', () => {
    expect(generatePlaywrightLocators(emptyModel('playwright-ts'))).toBe('');
  });
});
