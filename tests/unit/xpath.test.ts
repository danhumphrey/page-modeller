// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { xpathLiteral, generate } from '../../src/engine/candidates';

// XPath 1.0 has no escape sequences at all, so `JSON.stringify` was not an
// approximation of the right answer — it was a different language's. Both of
// its failures are the one SPEC §8 exists to prevent: a locator the eye
// certifies that finds nothing when the test runs.

describe('xpathLiteral', () => {
  it('wraps a plain value in single quotes', () => {
    expect(xpathLiteral('email')).toBe("'email'");
  });

  it('switches to double quotes for a value containing an apostrophe', () => {
    expect(xpathLiteral("O'Brien")).toBe('"O\'Brien"');
  });

  it('keeps single quotes for a value containing only double quotes', () => {
    expect(xpathLiteral('say "hi"')).toBe('\'say "hi"\'');
  });

  it('uses concat() when the value carries both', () => {
    // The case JSON.stringify could not express at all: it emitted a backslash
    // escape, which XPath rejects as a syntax error.
    expect(xpathLiteral(`it's "here"`)).toBe(`concat('it', "'", 's "here"')`);
  });

  it('leaves a newline alone rather than spelling it \\n', () => {
    // JSON.stringify turned one character into the two characters `\` and `n`,
    // which matches nothing while looking perfectly well-formed.
    expect(xpathLiteral('a\nb')).toBe("'a\nb'");
  });
});

/** Every xpath candidate the engine offers for `sel` in `html`. */
function xpathFor(html: string, sel: string): string | undefined {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const el = dom.window.document.querySelector(sel)!;
  const result = generate(el);
  return result.candidates.find((c) => c.candidate.kind === 'xpath')?.candidate.value;
}

describe('the xpath candidate', () => {
  it('anchors on an author-written id', () => {
    expect(xpathFor('<input id="email" data-t />', 'input')).toBe("//*[@id='email']");
  });

  it('does not anchor on a generated id', () => {
    // `cssFor` has always stepped around these; xpath did not, so the same
    // React id the CSS candidate carefully avoided became the whole XPath —
    // a locator that stops resolving on the next render.
    const path = xpathFor('<form><input id="_R_1h6kqsqppb6amH1_" /></form>', 'input');
    expect(path).not.toContain('_R_1h6kqsqppb6amH1_');
    expect(path).toMatch(/^\/html\[1\]/);
  });

  it('quotes an id that contains an apostrophe', () => {
    expect(xpathFor(`<input id="o'brien" />`, 'input')).toBe(`//*[@id="o'brien"]`);
  });
});
