import { describe, it, expect } from 'vitest';
import { canGenerate, generateCode, shapesFor } from '../../src/generators';
import { frameworks } from '../../src/frameworks';
import { classify } from '../../src/generators/classify';
import { typeValue } from '../../src/locators/display';
import type { LocatorCandidate } from '../../src/engine/types';
import { modelOf, elementsFor, SIGN_IN } from './fixtures/model';

/**
 * The shape `typeValue` produces. Seeing it in generated code means a candidate
 * the framework cannot express fell through the display fallback and was
 * emitted as prose.
 *
 * The guard used to be `/= \w+: /`, which could never fire: the leaked string
 * arrives inside a string literal, so there is always a quote between the `=`
 * and the kind. It was checked against every framework on every run and could
 * not have failed for any of them.
 */
const LEAKED = /\b(testId|role|label|placeholder|altText|title|css|xpath|className|tagName|linkText|partialLinkText): /;

describe('the generator registry', () => {
  it('covers every framework the toolbar offers', () => {
    // A framework in the selector that generates nothing is worse than one
    // that is not offered at all.
    for (const f of frameworks) {
      expect(canGenerate(f.id), f.label).toBe(true);
      const code = generateCode(modelOf(f.id, ...elementsFor(f.id)));
      expect(code, f.label).not.toBe('');
      // `type: value` in generated code means a candidate the framework cannot
      // express leaked through the display fallback.
      expect(code, f.label).not.toMatch(LEAKED);
    }
  });

  it('has a leak guard that can actually fire', () => {
    // A guard nothing can trip is worse than no guard: it reads as coverage.
    // Every kind the display fallback can produce must match it, so whichever
    // one leaks is caught.
    const kinds: LocatorCandidate[] = [
      { kind: 'testId', value: 'submit' },
      { kind: 'role', role: 'button', name: 'Submit' },
      { kind: 'label', text: 'Email' },
      { kind: 'placeholder', text: 'Email' },
      { kind: 'altText', text: 'Logo' },
      { kind: 'title', text: 'Close' },
      { kind: 'css', value: 'div.a' },
      { kind: 'xpath', value: '//div' },
      { kind: 'className', value: 'a' },
      { kind: 'tagName', value: 'div' },
      { kind: 'linkText', text: 'About' },
      { kind: 'partialLinkText', text: 'Abo' },
    ] as LocatorCandidate[];

    for (const c of kinds) {
      expect(typeValue(c), c.kind).toMatch(LEAKED);
    }
  });

  it('offers Locators only everywhere, under the same id', () => {
    for (const f of frameworks) {
      expect(shapesFor(f.id).map((s) => s.id), f.label).toContain('locators');
    }
  });

  it('defaults to the first shape, and falls back to it for an unknown one', () => {
    const model = modelOf('selenium-java', SIGN_IN);
    const methods = generateCode(model, 'methods');
    expect(generateCode(model)).toBe(methods);
    expect(generateCode(model, 'no-such-shape')).toBe(methods);
    expect(generateCode(model, 'locators')).not.toBe(methods);
  });

  it('says which target is missing rather than showing nothing', () => {
    // Unreachable while the test above passes — but a framework added to the
    // list without a generator should say so, not render blank.
    const model = modelOf('selenium-java', SIGN_IN);
    model.frameworkId = 'not-a-framework';
    expect(generateCode(model)).toContain('is not generated yet');
  });
});

describe('a native option is not clickable (SPEC §11)', () => {
  const bucket = (tag: string, role: string) =>
    classify({ tag, role, name: 'UnitedKingdom', candidates: [], selectedIndex: 0 } as never);

  it('classifies as static, so no click method is generated', () => {
    // Clicking an <option> is what Selenium's own documentation tells you not
    // to do — its Select class exists for this. A user can still add one by
    // hand; they get a getter rather than a call that cannot work.
    expect(bucket('option', 'option')).toBe('static');
  });

  it('still clicks a custom listbox option', () => {
    // A div with role="option" cannot be driven by Select, so clicking it is
    // exactly right. The tag is what decides, not the role.
    expect(bucket('div', 'option')).toBe('actionable');
  });
});

describe('a combobox is three different controls (SPEC §11)', () => {
  const bucket = (tag: string, role: string) =>
    classify({ tag, role, name: 'City', candidates: [], selectedIndex: 0 } as never);

  it('drives a real <select> through Select / selectOption', () => {
    expect(bucket('select', 'combobox')).toBe('select');
  });

  it('types into an <input role="combobox">', () => {
    // ARIA 1.2's combobox: a text field with a popup attached — every
    // autocomplete and type-ahead on the web. It was lumped in with the div
    // case and got a click and NO setter, so the one thing the control exists
    // for could not be driven at all.
    expect(bucket('input', 'combobox')).toBe('text');
    // The spec allows a textarea in the same role, and it is the same shape.
    expect(bucket('textarea', 'combobox')).toBe('text');
  });

  it('clicks a combobox built out of divs', () => {
    // `new Select(div)` throws UnexpectedTagNameException, and there is nothing
    // to type into — it is opened by clicking.
    expect(bucket('div', 'combobox')).toBe('actionable');
  });
});

describe('a helper that only works on a native element (SPEC §11)', () => {
  const bucket = (tag: string, role: string, inputType?: string) =>
    classify({ tag, role, inputType, name: 'X', candidates: [], selectedIndex: 0 } as never);

  it('toggles and radios need the native input', () => {
    // WebDriver's isSelected() is defined only for input[type=checkbox|radio]
    // and <option>; for anything else it returns false, always. role="switch"
    // has no native element at all, so isDarkModeChecked() reported false for
    // a switch that was on, and setDarkMode(true) clicked an on switch and
    // turned it OFF.
    expect(bucket('input', 'checkbox', 'checkbox')).toBe('toggle');
    expect(bucket('input', 'radio', 'radio')).toBe('radio');

    // Custom ones are clicked, which is always correct.
    expect(bucket('div', 'checkbox')).toBe('actionable');
    expect(bucket('div', 'radio')).toBe('actionable');
    expect(bucket('button', 'switch')).toBe('actionable');
  });

  it('a colour input gets no setter', () => {
    // Measured in Chromium: typing into a colour input leaves the value
    // untouched, and clear() sets it to #000000 — so a set method would report
    // success and silently leave the control black. Same pathology the slider
    // bucket was created for.
    expect(bucket('input', null as never, 'color')).toBe('static');
    // file is fine: clear() + sendKeys(path) is the documented upload idiom.
    expect(bucket('input', null as never, 'file')).toBe('text');
  });
});
