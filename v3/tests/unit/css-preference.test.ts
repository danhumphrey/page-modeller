// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { generate } from '../../src/engine/candidates';

/** The css candidate `generate` produces for the element with id `t`. */
function cssFor(html: string): string {
  document.body.innerHTML = html;
  const el = document.getElementById('t') ?? document.querySelector('[data-target]')!;
  const found = generate(el).candidates.find((c) => c.candidate.kind === 'css');
  return found && found.candidate.kind === 'css' ? found.candidate.value : '';
}

describe('the css candidate', () => {
  it('prefers a name over a generated id', () => {
    // Facebook's login field, verbatim: React's useId next to a real name.
    expect(cssFor('<input id="_R_1h6kqsqppb6amH1_" name="email" data-target>')).toBe('[name="email"]');
  });

  it('prefers a test id over both', () => {
    expect(cssFor('<input id="signin" name="email" data-testid="login-email" data-target>')).toBe(
      '[data-testid="login-email"]'
    );
  });

  it('still uses an id that was written by a person', () => {
    expect(cssFor('<input id="t" name="email">')).toBe('[name="email"]');
    expect(cssFor('<input id="t">')).toBe('#t');
  });

  it('falls back to a path rather than a generated id', () => {
    // css is Puppeteer's ONLY type, so a hash here is a locator that breaks on
    // the next deploy with nothing to fall back to.
    const out = cssFor('<div><span></span><b id="_R_1h6kqsqppb6amH1_" data-target></b></div>');
    expect(out).not.toContain('_R_1h');
    expect(out).toContain('b');
  });

  it('does not anchor a path on a generated ancestor id', () => {
    const out = cssFor('<div id="_R_1h6kqsqppb6amH1_"><span></span><b data-target></b></div>');
    expect(out).not.toContain('_R_1h');
  });

  it('anchors on a real ancestor id, keeping the path short', () => {
    expect(cssFor('<div id="login_form"><span></span><b data-target></b></div>')).toBe('#login_form > b');
  });

  it('reaches past id for other authored attributes', () => {
    // The tail of the cascade is what Puppeteer lives on: it has no linkText,
    // no getByLabel, nothing but css and xpath.
    expect(cssFor('<div><a href="/forgot" data-target>Forgotten password?</a><a href="/x">x</a></div>')).toBe(
      'a[href="/forgot"]'
    );
    expect(cssFor('<div><input aria-label="Search products" data-target><input></div>')).toBe(
      'input[aria-label="Search products"]'
    );
    expect(cssFor('<div><img alt="Acme logo" data-target><img alt="other"></div>')).toBe('img[alt="Acme logo"]');
    expect(cssFor('<form><button type="submit" data-target>Go</button><button>x</button></form>')).toBe(
      'button[type="submit"]'
    );
  });

  it('qualifies the weaker attributes with the tag', () => {
    // `[type="submit"]` is not a locator; `button[type="submit"]` is. name and
    // data-testid are strong enough to stand alone.
    expect(cssFor('<input name="email" id="t">')).toBe('[name="email"]');
    expect(cssFor('<div><input placeholder="Comment" data-target><input></div>')).toBe(
      'input[placeholder="Comment"]'
    );
  });

  it('ignores a name that does not single the element out', () => {
    // A radio group shares its name; the css candidate must still be unique.
    const out = cssFor('<input type="radio" name="plan"><input type="radio" name="plan" data-target>');
    expect(out).not.toBe('[name="plan"]');
  });
});
