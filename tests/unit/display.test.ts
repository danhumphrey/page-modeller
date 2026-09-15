import { describe, it, expect } from 'vitest';
import { displayLocator, displayElementLocator, playwrightExpr } from '../../src/locators/display';
import type { FrameStep, LocatorCandidate, ShadowStep } from '../../src/engine/types';

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

  it('renders Puppeteer as its own selector', () => {
    const pup = (c: Parameters<typeof displayLocator>[0]) => displayLocator(c, 'puppeteer');
    expect(pup({ kind: 'css', value: 'a[href="/forgot"]' })).toBe('locator(\'a[href="/forgot"]\')');
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

describe('displayElementLocator with a shadow path (SPEC §19)', () => {
  // The row has to read as the line that will be generated. Three targets
  // spell the host chain three different ways, and none of them was covered:
  // the table could have shown any of the three for all of them.
  const HOSTS: ShadowStep[] = [
    { host: { kind: 'css', value: 'outer-panel' } },
    { host: { kind: 'css', value: 'inner-field' } },
  ] as ShadowStep[];
  const FRAMES: FrameStep[] = [{ frame: { kind: 'css', value: '#checkout' } }] as FrameStep[];
  const COUPON: LocatorCandidate = { kind: 'css', value: '#coupon' };

  it('chains locator() for Playwright, in both spellings', () => {
    expect(displayElementLocator(COUPON, 'playwright-ts', [], HOSTS)).toBe(
      "locator('outer-panel').locator('inner-field').locator('#coupon')"
    );
    expect(displayElementLocator(COUPON, 'playwright-python', [], HOSTS)).toBe(
      'locator("outer-panel").locator("inner-field").locator("#coupon")'
    );
  });

  it('joins the hosts with Puppeteer’s deep combinator', () => {
    // `>>>` is inside the selector, not a prefix — Puppeteer has no frame
    // chaining, which is why frames read as ` › ` and hosts do not.
    expect(displayElementLocator(COUPON, 'puppeteer', [], HOSTS)).toBe(
      "locator('outer-panel >>> inner-field >>> #coupon')"
    );
  });

  it('reads the hosts as a path for Selenium, which cannot express them', () => {
    // A `By` is tree-agnostic: the generated code walks `getShadowRoot()` per
    // host before it is used, so the row says where the element lives.
    expect(displayElementLocator(COUPON, 'selenium-java', [], HOSTS)).toBe(
      'outer-panel › inner-field › css: #coupon'
    );
  });

  it('puts frames before hosts, in that order, in every target', () => {
    // A frame containing a component: the frame chain is entered first and the
    // host chain walked inside it. Reversed, the row describes a page that
    // does not exist.
    expect(displayElementLocator(COUPON, 'playwright-ts', FRAMES, HOSTS)).toBe(
      "frameLocator('#checkout').locator('outer-panel').locator('inner-field').locator('#coupon')"
    );
    expect(displayElementLocator(COUPON, 'selenium-java', FRAMES, HOSTS)).toBe(
      '#checkout › outer-panel › inner-field › css: #coupon'
    );
    expect(displayElementLocator(COUPON, 'puppeteer', FRAMES, HOSTS)).toBe(
      "#checkout › locator('outer-panel >>> inner-field >>> #coupon')"
    );
  });

  it('is the plain expression when there is no chain at all', () => {
    expect(displayElementLocator(COUPON, 'playwright-ts', [], [])).toBe("locator('#coupon')");
    expect(displayElementLocator(COUPON, 'selenium-java', undefined, undefined)).toBe('css: #coupon');
  });
});
