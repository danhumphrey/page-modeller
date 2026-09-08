import { describe, it, expect } from 'vitest';
import { displayLocator, playwrightExpr } from '../../src/locators/display';

describe('displayLocator', () => {
  it('renders Playwright as the framework expression', () => {
    expect(displayLocator({ kind: 'role', role: 'button', name: 'Sign in', exact: true }, 'playwright-ts')).toBe(
      "getByRole('button', { name: 'Sign in', exact: true })"
    );
    expect(displayLocator({ kind: 'testId', value: 'submit' }, 'playwright-python')).toBe("getByTestId('submit')");
  });

  it('always emits exact: true for a named role (SPEC §12)', () => {
    expect(playwrightExpr({ kind: 'role', role: 'link', name: 'About' })).toContain('exact: true');
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
