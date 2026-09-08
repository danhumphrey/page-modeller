import { describe, it, expect } from 'vitest';
import { displayLocator, playwrightExpr } from '../../src/locators/display';

describe('displayLocator', () => {
  it('renders Playwright as the framework expression', () => {
    expect(displayLocator({ kind: 'role', role: 'button', name: 'Sign in', exact: true }, 'playwright-ts')).toBe(
      "getByRole('button', { name: 'Sign in', exact: true })"
    );
    expect(displayLocator({ kind: 'testId', value: 'submit' }, 'playwright-python')).toBe("getByTestId('submit')");
  });

  it('renders exact faithfully rather than forcing it', () => {
    // SPEC §12 says generated candidates always carry exact: true — that is the
    // engine's guarantee, not the renderer's. A hand-edited locator may
    // deliberately want Playwright's substring default, and must render as such
    // or the table would lie about what the test will do.
    expect(playwrightExpr({ kind: 'role', role: 'link', name: 'About', exact: true })).toContain('exact: true');
    expect(playwrightExpr({ kind: 'role', role: 'link', name: 'About' })).toBe("getByRole('link', { name: 'About' })");
  });

  it('prefixes an xpath, which Playwright will not infer', () => {
    // Playwright reads a leading `//` or `..` as XPath and everything else as
    // CSS. The engine's fallback path starts with a single `/`, so without the
    // prefix the generated call throws "Unexpected token /".
    expect(playwrightExpr({ kind: 'xpath', value: '/html[1]/body[1]/div[2]' })).toBe(
      "locator('xpath=/html[1]/body[1]/div[2]')"
    );
    // Prefixed unconditionally: `//` would work bare, but two spellings of the
    // same thing is one more thing to get wrong.
    expect(playwrightExpr({ kind: 'xpath', value: '//*[@id="t"]' })).toBe("locator('xpath=//*[@id=\"t\"]')");
    // CSS is untouched.
    expect(playwrightExpr({ kind: 'css', value: 'button.pay' })).toBe("locator('button.pay')");
  });

  it('renders other frameworks as type: value', () => {
    expect(displayLocator({ kind: 'css', value: 'button.pay' }, 'selenium-java')).toBe('css: button.pay');
    expect(displayLocator({ kind: 'xpath', value: '//a[1]' }, 'puppeteer')).toBe('xpath: //a[1]');
  });

  it('escapes quotes so the expression stays valid', () => {
    expect(playwrightExpr({ kind: 'text', text: "It's here", exact: true })).toBe("getByText('It\\'s here', { exact: true })");
  });

  it('omits the name option when the role has no accessible name', () => {
    expect(playwrightExpr({ kind: 'role', role: 'navigation' })).toBe("getByRole('navigation')");
  });
});
