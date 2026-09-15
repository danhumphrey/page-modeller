import { describe, it, expect } from 'vitest';
import { generateSeleniumCSharp, generateSeleniumCSharpLocators } from '../../src/generators/selenium-csharp';
import { emptyModel } from '../../src/model';
import type { LocatorCandidate } from '../../src/engine/types';
import { modelOf, EMAIL, SIGN_IN, COUNTRY, TOPPINGS, REMEMBER, LOGO, HEADING, type TestElement } from './fixtures/model';

const gen = (...els: TestElement[]) => generateSeleniumCSharp(modelOf('selenium-csharp', ...els));

describe('generateSeleniumCSharp', () => {
  it('spells every By strategy the .NET way', () => {
    const cases: Array<[LocatorCandidate, string]> = [
      [{ kind: 'id', value: 'a' }, 'By.Id("a")'],
      [{ kind: 'name', value: 'a' }, 'By.Name("a")'],
      [{ kind: 'className', value: 'a' }, 'By.ClassName("a")'],
      [{ kind: 'tagName', value: 'a' }, 'By.TagName("a")'],
      [{ kind: 'linkText', text: 'a' }, 'By.LinkText("a")'],
      [{ kind: 'partialLinkText', text: 'a' }, 'By.PartialLinkText("a")'],
      [{ kind: 'css', value: 'a' }, 'By.CssSelector("a")'],
      [{ kind: 'xpath', value: '//a' }, 'By.XPath("//a")'],
    ];
    for (const [candidate, expected] of cases) {
      expect(gen({ name: 'X', role: 'button', tag: 'button', candidate }), expected).toContain(expected);
    }
  });

  it('returns IWebElement with Allman braces', () => {
    expect(gen(SIGN_IN)).toContain('public IWebElement GetSignInElement()\n{\n    return driver.FindElement(By.Id("go"));\n}');
  });

  it('takes a default argument instead of Java’s overload', () => {
    const out = gen(EMAIL);
    expect(out).toContain('public void SetEmailAddress(string value, bool clearFirst = true)');
    expect(out).not.toContain('SetEmailAddress(string value)\n{');
    expect(out).toContain('GetDomProperty("value")');
  });

  it('avoids `checked`, which is a C# keyword', () => {
    const out = gen(REMEMBER);
    expect(out).toContain('public void SetRememberMe(bool isChecked)');
    expect(out).toContain('el.Selected != isChecked');
  });

  it('reads Selenium properties as properties, not getters', () => {
    expect(gen(HEADING)).toContain('return GetWelcomeElement().Text;');
    expect(gen(REMEMBER)).toContain('return GetRememberMeElement().Selected;');
  });

  it('uses SelectElement and params for a multi-select', () => {
    const out = gen(TOPPINGS);
    expect(out).toContain('public SelectElement GetToppingsSelect()');
    expect(out).toContain('public IList<string> GetToppingsTexts()');
    expect(out).toContain('AllSelectedOptions.Select(o => o.Text).ToList()');
    expect(out).toContain('public void SetToppingsByValues(params string[] values)');
    // DeselectAll first, or SelectByValue adds to the selection.
    expect(out.indexOf('el.DeselectAll();')).toBeLessThan(out.indexOf('el.SelectByValue(value);'));
    expect(out).toContain('public void DeselectAllToppings()');
  });

  it('gives a single select no DeselectAll, which throws on one', () => {
    const out = gen(COUNTRY);
    expect(out).toContain('SelectedOption.Text');
    expect(out).not.toContain('DeselectAllCountry');
  });

  it('reads an image by its alt', () => {
    const out = gen(LOGO);
    expect(out).toContain('public string GetLogoAltText()');
    expect(out).toContain('GetDomAttribute("alt")');
    expect(out).not.toContain('ClickLogo');
  });
});

describe('generateSeleniumCSharpLocators', () => {
  it('emits underscore-prefixed private fields, the .NET convention', () => {
    expect(generateSeleniumCSharpLocators(modelOf('selenium-csharp', EMAIL, SIGN_IN))).toBe(
      ['private readonly By _emailAddress = By.Name("email");', 'private readonly By _signIn = By.Id("go");'].join('\n')
    );
  });

  it('emits nothing for an empty model', () => {
    expect(generateSeleniumCSharpLocators(emptyModel('selenium-csharp'))).toBe('');
  });
});
