import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { baseName, uniqueName } from '../../src/engine/naming';

let used: Set<string>;
beforeEach(() => {
  used = new Set();
});

/** Derive then reserve — the split the message boundary forces: baseName runs
 *  in the page, uniqueName in the panel, which owns the model. */
const name = (e: Element) => uniqueName(baseName(e), used);

function el(html: string, sel = '[data-t]'): Element {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const found = dom.window.document.querySelector(sel);
  if (!found) throw new Error(`no match for ${sel}`);
  return found;
}

describe('baseName', () => {
  it('fixes the word-boundary bug', () => {
    // v2.5.1 stripped whitespace before camelCase and produced TableofContents.
    expect(name(el('<button data-t>Table of Contents</button>'))).toBe('TableOfContents');
    expect(name(el('<a href="#" data-t>Document Upload and Query</a>'))).toBe('DocumentUploadAndQuery');
  });

  it('keeps plain names — no role suffix', () => {
    expect(name(el('<a href="#" data-t>About</a>'))).toBe('About');
  });

  it('ranks the accessible name above name and id', () => {
    // v2.5.1 named this Btn1, because id outranked text content.
    expect(name(el('<button id="btn-1" name="go" data-t>Submit</button>'))).toBe('Submit');
  });

  it('uses a label association for the accessible name', () => {
    expect(name(el('<label for="e">Email address</label><input id="e" data-t />', 'input'))).toBe('EmailAddress');
  });

  it('falls back through placeholder, name, then id', () => {
    expect(name(el('<input data-t placeholder="Your password" />'))).toBe('YourPassword');
    expect(name(el('<input data-t name="firstName" />'))).toBe('FirstName');
    expect(name(el('<input data-t id="last-name" />'))).toBe('LastName');
  });

  it('describes self-describing inputs when nothing else names them', () => {
    expect(name(el('<input type="password" data-t />'))).toBe('PasswordElement');
  });

  it('falls back to tag and index', () => {
    expect(name(el('<div data-t></div>'))).toBe('Div1');
  });

  it('does not start a name with a digit', () => {
    expect(name(el('<button data-t>2 items</button>'))).toBe('Element2Items');
  });

  it('truncates on a word boundary', () => {
    const n = name(el('<button data-t>Download the quarterly revenue report</button>'));
    expect(n.length).toBeLessThanOrEqual(25);
    // Mid-word truncation, as in v2.5.1, would give "DownloadTheQuarterlyReve".
    expect(n).toBe('DownloadTheQuarterly');
  });

  it('folds multi-line text into one name', () => {
    // v2.5.1 read raw textContent and cut at the first newline, giving
    // "Feedback". accname normalises whitespace, so the accessible name really
    // is "Feedback and support" — the better name anyway.
    expect(name(el('<a href="#" data-t>Feedback\nand support</a>'))).toBe('FeedbackAndSupport');
  });
});

describe('build-generated identifiers', () => {
  // These change on the next build of the site under test, so a name derived
  // from one rots. Falling through to the next rule is always better.
  const rejected = [
    ['emotion', '<div data-t class="css-1q2w3e"></div>'],
    ['styled-components', '<div data-t class="sc-bdVaJa"></div>'],
    ['CSS Modules', '<div data-t class="Button_root__2xK9f"></div>'],
    ['leading underscore', '<div data-t class="_2xK9f"></div>'],
    ['no vowels', '<div data-t class="Xtvsq51"></div>'],
    ['hashed id', '<div data-t id="Xtvsq51"></div>'],
  ] as const;

  for (const [label, html] of rejected) {
    it(`skips ${label}`, () => {
      // Falls through to the tag+index rule.
      expect(name(el(html))).toBe('Div1');
    });
  }

  const kept = [
    ['btn', '<div data-t class="btn"></div>', 'Btn'],
    ['nav', '<div data-t class="nav"></div>', 'Nav'],
    ['hyphenated', '<div data-t class="col-md-6"></div>', 'ColMd6'],
    ['real word', '<div data-t class="site-header"></div>', 'SiteHeader'],
    ['readable id', '<div data-t id="login-form"></div>', 'LoginForm'],
  ] as const;

  for (const [label, html, expected] of kept) {
    it(`keeps ${label}`, () => {
      expect(name(el(html))).toBe(expected);
    });
  }
});

describe('uniqueName', () => {
  it('de-dupes by counter', () => {
    const mk = () => name(el('<a href="#" data-t>About</a>'));
    expect([mk(), mk(), mk()]).toEqual(['About', 'About2', 'About3']);
  });

  it('reserves the name it returns', () => {
    uniqueName('About', used);
    expect(used.has('About')).toBe(true);
  });
});
