import { describe, it, expect } from 'vitest';
import { generatePlaywrightTs } from '../../src/generators/playwright-ts';
import { emptyModel, type ModelElement, type TabModel } from '../../src/model';
import type { LocatorCandidate } from '../../src/engine/types';

function model(...elements: Array<Partial<ModelElement> & { name: string; candidate: LocatorCandidate }>): TabModel {
  const m = emptyModel('playwright-ts');
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

const gen = (...args: Parameters<typeof model>) => generatePlaywrightTs(model(...args));

describe('generatePlaywrightTs', () => {
  it('emits a lazy locator getter, not an element lookup', () => {
    // A Locator is lazy, so it never goes stale and costs nothing to hold.
    const out = gen({
      name: 'SignIn',
      role: 'button',
      tag: 'button',
      candidate: { kind: 'role', role: 'button', name: 'Sign in', exact: true },
    });
    expect(out).toContain('getSignInLocator(): Locator {');
    expect(out).toContain("return page.getByRole('button', { name: 'Sign in', exact: true });");
  });

  it('keeps exact: true, which the engine guarantees', () => {
    const out = gen({ name: 'About', role: 'link', tag: 'a', candidate: { kind: 'text', text: 'About', exact: true } });
    expect(out).toContain("getByText('About', { exact: true })");
  });

  it('awaits every action and types the promise', () => {
    const out = gen({ name: 'SignIn', role: 'button', tag: 'button', candidate: { kind: 'css', value: 'button' } });
    expect(out).toContain('async clickSignIn(): Promise<void> {');
    expect(out).toContain('await getSignInLocator().click();');
  });

  it('fills a text field, and can append instead', () => {
    // fill() clears by construction, so v2.5.1's accidental append cannot
    // happen — but appending stays reachable, as in the Selenium template.
    const out = gen({ name: 'Email', role: 'textbox', tag: 'input', candidate: { kind: 'label', text: 'Email', exact: true } });
    expect(out).toContain('async setEmail(value: string, clearFirst = true): Promise<void> {');
    expect(out).toContain('.fill(value);');
    expect(out).toContain('.pressSequentially(value);');
    expect(out).toContain('.inputValue();');
  });

  it('uses check and uncheck rather than clicking to toggle', () => {
    const out = gen({ name: 'Remember', role: 'checkbox', tag: 'input', candidate: { kind: 'css', value: '#r' } });
    expect(out).toContain('await (checked ? getRememberLocator().check() : getRememberLocator().uncheck());');
    expect(out).not.toContain('.click()');
  });

  it('gives a radio check() only — uncheck() throws on one', () => {
    // Playwright agreeing that v2.5.1's set(false) never meant anything.
    const out = gen({ name: 'Pro', role: 'radio', tag: 'input', candidate: { kind: 'css', value: '#p' } });
    expect(out).toContain('async selectPro(): Promise<void> {');
    expect(out).toContain('.check();');
    expect(out).not.toContain('uncheck');
  });

  it('selects by value or label on a single select', () => {
    const out = gen({ name: 'Country', role: 'combobox', tag: 'select', candidate: { kind: 'css', value: '#c' } });
    expect(out).toContain('await getCountryLocator().selectOption({ value });');
    expect(out).toContain('await getCountryLocator().selectOption({ label });');
  });

  it('replaces the whole selection on a multi-select', () => {
    // selectOption replaces, so there is no deselectAll step and no way to
    // accidentally add to what was already chosen — unlike Selenium.
    const out = gen({ name: 'Toppings', role: 'listbox', tag: 'select', candidate: { kind: 'css', value: '#t' } });
    expect(out).toContain('async setToppingsByValues(...values: string[]): Promise<void> {');
    expect(out).toContain('values.map((value) => ({ value }))');
    expect(out).toContain('async deselectAllToppings(): Promise<void> {');
    expect(out).toContain('.selectOption([]);');
  });

  it('reads a static element, and an image by its alt', () => {
    expect(gen({ name: 'Welcome', role: 'heading', tag: 'h1', candidate: { kind: 'css', value: 'h1' } })).toContain(
      '.textContent();'
    );
    const img = gen({ name: 'Logo', role: 'img', tag: 'img', candidate: { kind: 'altText', text: 'Acme' } });
    expect(img).toContain("getAttribute('alt');");
    expect(img).not.toContain('clickLogo');
  });

  it('classifies a password field as text despite it having no role', () => {
    const out = gen({ name: 'Password', role: null, tag: 'input', inputType: 'password', candidate: { kind: 'css', value: '#p' } });
    expect(out).toContain('async setPassword(');
  });

  it('emits nothing for an empty model', () => {
    expect(generatePlaywrightTs(emptyModel('playwright-ts'))).toBe('');
  });
});
