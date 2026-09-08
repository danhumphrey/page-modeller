import { describe, it, expect } from 'vitest';
import { generateSeleniumJava } from '../../src/generators/selenium-java';
import { emptyModel, type ModelElement, type TabModel } from '../../src/model';
import type { LocatorCandidate } from '../../src/engine/types';

function model(...elements: Array<Partial<ModelElement> & { name: string; candidate: LocatorCandidate }>): TabModel {
  const m = emptyModel('selenium-java');
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

const gen = (...args: Parameters<typeof model>) => generateSeleniumJava(model(...args));

describe('generateSeleniumJava', () => {
  it('emits a banner and an element getter for everything', () => {
    const out = gen({ name: 'SignIn', role: 'button', tag: 'button', candidate: { kind: 'id', value: 'go' } });
    expect(out).toContain('* SignIn');
    expect(out).toContain('public WebElement getSignInElement() {');
    expect(out).toContain('return driver.findElement(By.id("go"));');
  });

  it('maps every locator type to its By strategy', () => {
    const cases: Array<[LocatorCandidate, string]> = [
      [{ kind: 'id', value: 'a' }, 'By.id("a")'],
      [{ kind: 'name', value: 'a' }, 'By.name("a")'],
      [{ kind: 'className', value: 'a' }, 'By.className("a")'],
      [{ kind: 'tagName', value: 'a' }, 'By.tagName("a")'],
      [{ kind: 'linkText', text: 'a' }, 'By.linkText("a")'],
      [{ kind: 'partialLinkText', text: 'a' }, 'By.partialLinkText("a")'],
      [{ kind: 'css', value: 'a' }, 'By.cssSelector("a")'],
      [{ kind: 'xpath', value: '//a' }, 'By.xpath("//a")'],
    ];
    for (const [candidate, expected] of cases) {
      expect(gen({ name: 'X', candidate }), expected).toContain(expected);
    }
  });

  it('escapes quotes and backslashes in a locator', () => {
    expect(gen({ name: 'X', candidate: { kind: 'css', value: 'a[title="hi"]' } })).toContain(
      'By.cssSelector("a[title=\\"hi\\"]")'
    );
  });

  describe('the six fixes to v2.5.1', () => {
    it('classifies on role, not tagName', () => {
      // v2.5.1 keyed on tags, so <div role="button"> got no click() at all.
      const out = gen({ name: 'LogIn', role: 'button', tag: 'div', candidate: { kind: 'css', value: 'div' } });
      expect(out).toContain('public void clickLogIn() {');
    });

    it('reads a text field with getDomProperty, not getAttribute', () => {
      // getAttribute returns the INITIAL value and never changes as you type.
      const out = gen({ name: 'Email', role: 'textbox', tag: 'input', candidate: { kind: 'id', value: 'e' } });
      expect(out).toContain('getDomProperty("value")');
      expect(out).not.toContain('getAttribute("value")');
    });

    it('clears a text field before typing into it', () => {
      const out = gen({ name: 'Email', role: 'textbox', tag: 'input', candidate: { kind: 'id', value: 'e' } });
      expect(out).toMatch(/el\.clear\(\);\s*\n\s*el\.sendKeys\(value\);/);
    });

    it('treats an image as static, reading alt rather than text', () => {
      // getText() on an <img> returns an empty string.
      const out = gen({ name: 'Logo', role: 'img', tag: 'img', candidate: { kind: 'css', value: 'img' } });
      expect(out).toContain('public String getLogoAltText() {');
      expect(out).toContain('getDomAttribute("alt")');
      expect(out).not.toContain('clickLogo');
    });

    it('gives a radio no set(false), which never worked', () => {
      // Clicking a checked radio does not uncheck it.
      const out = gen({ name: 'Pro', role: 'radio', tag: 'input', candidate: { kind: 'id', value: 'p' } });
      expect(out).toContain('public void selectPro() {');
      expect(out).toContain('public boolean isProSelected() {');
      expect(out).not.toContain('setPro(boolean');
    });

    it('replaces rather than adds on a multi-select, and reads all of it', () => {
      const out = gen({ name: 'Toppings', role: 'listbox', tag: 'select', candidate: { kind: 'id', value: 't' } });
      expect(out).toContain('el.deselectAll();');
      expect(out).toContain('public void setToppingsByValues(String... values) {');
      expect(out).toContain('getAllSelectedOptions()');
      expect(out).toContain('public void deselectAllToppings() {');
      expect(out).not.toContain('getFirstSelectedOption');
    });
  });

  it('gives a single select the first-selected accessors, and no deselectAll', () => {
    // deselectAll throws UnsupportedOperationException on a single select.
    const out = gen({ name: 'Country', role: 'combobox', tag: 'select', candidate: { kind: 'id', value: 'c' } });
    expect(out).toContain('getFirstSelectedOption()');
    expect(out).toContain('public void setCountryByValue(String value) {');
    expect(out).not.toContain('deselectAll');
  });

  it('falls back to click for a combobox that is not a real <select>', () => {
    // new Select(div) throws UnexpectedTagNameException.
    const out = gen({ name: 'Country', role: 'combobox', tag: 'div', candidate: { kind: 'css', value: 'div' } });
    expect(out).toContain('public void clickCountry() {');
    expect(out).not.toContain('new Select');
  });

  it('treats a password field as text even though it has no role', () => {
    // input[type=password] has no ARIA role, so role alone would call it static
    // and generate a getText() for a field you type into.
    const out = gen({ name: 'Password', role: null, tag: 'input', inputType: 'password', candidate: { kind: 'id', value: 'p' } });
    expect(out).toContain('public void setPassword(String value) {');
  });

  it('reads a static element as text', () => {
    const out = gen({ name: 'Welcome', role: 'heading', tag: 'h1', candidate: { kind: 'css', value: 'h1' } });
    expect(out).toContain('public String getWelcome() {');
    expect(out).toContain('.getText();');
  });

  it('separates elements, and emits nothing for an empty model', () => {
    const out = gen(
      { name: 'A', role: 'button', tag: 'button', candidate: { kind: 'id', value: 'a' } },
      { name: 'B', role: 'link', tag: 'a', candidate: { kind: 'linkText', text: 'b' } }
    );
    expect(out).toContain('* A');
    expect(out).toContain('* B');
    expect(generateSeleniumJava(emptyModel('selenium-java'))).toBe('');
  });
});
