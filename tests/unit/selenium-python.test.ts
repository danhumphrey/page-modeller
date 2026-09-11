import { describe, it, expect } from 'vitest';
import { generateSeleniumPython, generateSeleniumPythonLocators } from '../../src/generators/selenium-python';
import { emptyModel } from '../../src/model';
import type { LocatorCandidate } from '../../src/engine/types';
import { modelOf, EMAIL, SIGN_IN, COUNTRY, TOPPINGS, REMEMBER, LOGO, HEADING, type TestElement } from './fixtures/model';

const gen = (...els: TestElement[]) => generateSeleniumPython(modelOf('selenium-python', ...els));

describe('generateSeleniumPython', () => {
  it('spells every By strategy as a Python constant', () => {
    const cases: Array<[LocatorCandidate, string]> = [
      [{ kind: 'id', value: 'a' }, 'By.ID, "a"'],
      [{ kind: 'name', value: 'a' }, 'By.NAME, "a"'],
      [{ kind: 'className', value: 'a' }, 'By.CLASS_NAME, "a"'],
      [{ kind: 'tagName', value: 'a' }, 'By.TAG_NAME, "a"'],
      [{ kind: 'linkText', text: 'a' }, 'By.LINK_TEXT, "a"'],
      [{ kind: 'partialLinkText', text: 'a' }, 'By.PARTIAL_LINK_TEXT, "a"'],
      [{ kind: 'css', value: 'a' }, 'By.CSS_SELECTOR, "a"'],
      [{ kind: 'xpath', value: '//a' }, 'By.XPATH, "//a"'],
    ];
    for (const [candidate, expected] of cases) {
      expect(gen({ name: 'X', role: 'button', tag: 'button', candidate }), expected).toContain(expected);
    }
  });

  it('names functions in snake_case, splitting the PascalCase name', () => {
    const out = gen(EMAIL);
    expect(out).toContain('def get_email_address_element():\n    return driver.find_element(By.NAME, "email")');
    expect(out).toContain('def set_email_address(value, clear_first=True):');
    expect(out).toContain('get_property("value")');
  });

  it('separates definitions by two blank lines, per PEP 8', () => {
    expect(gen(SIGN_IN)).toContain('\n\n\ndef click_sign_in():');
  });

  it('toggles by comparing state, not by clicking blind', () => {
    const out = gen(REMEMBER);
    expect(out).toContain('def is_remember_me_checked():\n    return get_remember_me_element().is_selected()');
    expect(out).toContain('    if el.is_selected() != checked:\n        el.click()');
  });

  it('reads a multi-select with a comprehension and replaces the selection', () => {
    const out = gen(TOPPINGS);
    expect(out).toContain('def get_toppings_texts():\n    return [o.text for o in get_toppings_select().all_selected_options]');
    expect(out).toContain('def set_toppings_by_values(*values):');
    expect(out.indexOf('el.deselect_all()')).toBeLessThan(out.indexOf('el.select_by_value(value)'));
    expect(out).toContain('def deselect_all_toppings():');
  });

  it('gives a single select no deselect_all, which throws on one', () => {
    const out = gen(COUNTRY);
    expect(out).toContain('first_selected_option.text');
    expect(out).not.toContain('def deselect_all_country');
  });

  it('reads static text, and an image by its alt', () => {
    expect(gen(HEADING)).toContain('def get_welcome():\n    return get_welcome_element().text');
    const img = gen(LOGO);
    expect(img).toContain('def get_logo_alt_text():');
    expect(img).toContain('get_dom_attribute("alt")');
  });
});

describe('generateSeleniumPythonLocators', () => {
  it('emits locator tuples as module constants', () => {
    expect(generateSeleniumPythonLocators(modelOf('selenium-python', EMAIL, SIGN_IN))).toBe(
      ['EMAIL_ADDRESS = (By.NAME, "email")', 'SIGN_IN = (By.ID, "go")'].join('\n')
    );
  });

  it('emits nothing for an empty model', () => {
    expect(generateSeleniumPythonLocators(emptyModel('selenium-python'))).toBe('');
  });
});
