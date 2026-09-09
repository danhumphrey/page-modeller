import { describe, it, expect } from 'vitest';
import { displayLocator, playwrightExpr } from '../../src/locators/display';

describe('displayLocator', () => {
  it('renders Playwright as the framework expression', () => {
    expect(displayLocator({ kind: 'role', role: 'button', name: 'Sign in', exact: true }, 'playwright-ts')).toBe(
      "getByRole('button', { name: 'Sign in', exact: true })"
    );
    // Playwright Python is the same decisions in Python spelling.
    expect(displayLocator({ kind: 'testId', value: 'submit' }, 'playwright-python')).toBe('get_by_test_id("submit")');
    expect(displayLocator({ kind: 'role', role: 'button', name: "It's here", exact: true }, 'playwright-python')).toBe(
      'get_by_role("button", name="It\'s here", exact=True)'
    );
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

  it('renders Selenium as type: value', () => {
    expect(displayLocator({ kind: 'css', value: 'button.pay' }, 'selenium-java')).toBe('css: button.pay');
    expect(displayLocator({ kind: 'xpath', value: '//a[1]' }, 'selenium-csharp')).toBe('xpath: //a[1]');
  });

  it('renders Puppeteer as its own selector, P-selectors and all', () => {
    const pup = (c: Parameters<typeof displayLocator>[0]) => displayLocator(c, 'puppeteer');
    // ::-p-aria reads the accessibility tree, so role survives into Puppeteer.
    expect(pup({ kind: 'role', role: 'link', name: 'Forgotten password?', exact: true })).toBe(
      'locator(\'::-p-aria([name="Forgotten password?"][role="link"])\')'
    );
    expect(pup({ kind: 'role', role: 'button' })).toBe('locator(\'::-p-aria([role="button"])\')');
    expect(pup({ kind: 'text', text: 'Create new account', exact: true })).toBe(
      'locator(\'::-p-text("Create new account")\')'
    );
    expect(pup({ kind: 'css', value: '[name="email"]' })).toBe('locator(\'[name="email"]\')');
    // `xpath/` prefix, not Playwright's `xpath=`; the doubled slash is right.
    expect(pup({ kind: 'xpath', value: '//a[1]' })).toBe("locator('xpath///a[1]')");
  });

  it('escapes quotes so the expression stays valid', () => {
    expect(playwrightExpr({ kind: 'text', text: "It's here", exact: true })).toBe("getByText('It\\'s here', { exact: true })");
  });

  it('omits the name option when the role has no accessible name', () => {
    expect(playwrightExpr({ kind: 'role', role: 'navigation' })).toBe("getByRole('navigation')");
  });
});
