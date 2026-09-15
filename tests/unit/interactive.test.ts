// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { collectInteractive, isInteractiveRole } from '../../src/engine/interactive';

// jsdom has no layout: every getBoundingClientRect is 0x0, and the scan now
// asks whether an element renders anything (SPEC §4). So layout is supplied
// here — everything has a box unless the test says otherwise with
// `data-nobox`, which is how the one case that matters is expressed.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const none = this.closest('[data-nobox]') !== null;
    const size = none ? 0 : 10;
    return { width: size, height: size, top: 0, left: 0, right: size, bottom: size, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

function root(html: string): Element {
  document.body.innerHTML = `<div id="root">${html}</div>`;
  return document.getElementById('root')!;
}

const names = (els: Element[]) => els.map((e) => e.getAttribute('data-n'));

describe('isInteractiveRole', () => {
  it('accepts the four interactive buckets', () => {
    for (const role of ['button', 'link', 'textbox', 'checkbox', 'combobox', 'listbox', 'tab', 'switch']) {
      expect(isInteractiveRole(role), role).toBe(true);
    }
  });

  it('rejects static roles', () => {
    // A scan of a page would otherwise return every heading and image on it.
    for (const role of ['heading', 'img', 'paragraph', 'cell', 'main', null]) {
      expect(isInteractiveRole(role), String(role)).toBe(false);
    }
  });
});

describe('collectInteractive', () => {
  it('takes interactive descendants in document order', () => {
    const el = root(`
      <h1 data-n="heading">Ignored</h1>
      <a href="/a" data-n="link">A</a>
      <p data-n="para">Ignored</p>
      <button data-n="button">B</button>
      <input data-n="input" aria-label="C" />
    `);
    expect(names(collectInteractive(el, false))).toEqual(['link', 'button', 'input']);
  });

  it('is role-derived, not tagName-derived', () => {
    const el = root(`
      <div role="button" data-n="div-button">Go</div>
      <a data-n="anchor-no-href">Not a link</a>
    `);
    // <a> without href has no link role; <div role="button"> is a control.
    expect(names(collectInteractive(el, false))).toEqual(['div-button']);
  });

  it('never includes the container itself', () => {
    // You are modelling what is inside the section you chose (SPEC §4).
    document.body.innerHTML = '<div role="button" id="root"><span>x</span></div>';
    const el = document.getElementById('root')!;
    expect(collectInteractive(el, false)).toEqual([]);
  });

  it('skips elements hidden from the accessibility tree by default', () => {
    const el = root(`
      <button data-n="visible">Yes</button>
      <button data-n="aria-hidden" aria-hidden="true">No</button>
      <button data-n="attr-hidden" hidden>No</button>
      <div style="display: none"><button data-n="in-hidden-parent">No</button></div>
    `);
    expect(names(collectInteractive(el, false))).toEqual(['visible']);
  });

  it('includes them when modelHiddenElements is on', () => {
    // A validation message or an unopened modal is real page-object material,
    // and Add cannot reach what is not rendered (SPEC §4).
    const el = root(`
      <button data-n="visible">Yes</button>
      <button data-n="hidden" aria-hidden="true">Also</button>
    `);
    expect(names(collectInteractive(el, true))).toEqual(['visible', 'hidden']);
  });

  it('collects form controls that HTML-AAM gives no role', () => {
    // input[type=password] has no ARIA role, so a role-only rule skips it — and
    // a scan of a login form that misses the password field is plainly broken.
    const el = root(`
      <input type="password" data-n="password" />
      <input type="file" data-n="file" />
      <input type="date" data-n="date" />
      <input type="hidden" data-n="hidden" />
    `);
    expect(names(collectInteractive(el, false))).toEqual(['password', 'file', 'date']);
  });

  it('finds controls at any depth', () => {
    const el = root('<div><section><form><button data-n="deep">Deep</button></form></section></div>');
    expect(names(collectInteractive(el, false))).toEqual(['deep']);
  });
});

describe("a select's options are not scanned (SPEC §4)", () => {
  it('collects the select and none of its options', () => {
    // A country picker put 250 rows in the model — and every one of them was a
    // locator nobody can use, because an option is reached through its select.
    const r = root(`
      <select name="country">
        <option>United Kingdom</option>
        <option>United States</option>
      </select>`);
    expect(collectInteractive(r, false).map((e) => e.localName)).toEqual(['select']);
  });

  it('leaves a custom listbox alone', () => {
    // Built from divs, so `Select` cannot drive it and each option IS clicked.
    // The distinction is the tag, not the role.
    const r = root(`
      <div role="listbox">
        <div role="option">United Kingdom</div>
        <div role="option">United States</div>
      </div>`);
    expect(collectInteractive(r, false).map((e) => e.getAttribute('role'))).toEqual(['listbox', 'option', 'option']);
  });

  it('skips optgroup too', () => {
    const r = root(`
      <select name="country">
        <optgroup label="Europe"><option>United Kingdom</option></optgroup>
      </select>`);
    expect(collectInteractive(r, false).map((e) => e.localName)).toEqual(['select']);
  });
});

describe('an element that renders nothing (SPEC §4)', () => {
  it('is skipped by default, even though the a11y tree exposes it', () => {
    // The case from a real page: an empty <a> inside a cookie banner whose
    // ancestors are collapsed to `height: 0`. Nothing is display:none or
    // visibility:hidden, so it IS in the accessibility tree — Playwright's
    // getByRole('link') matches it, measured — and it is still not something
    // anyone wants in a page object. The eye could not even outline it: it
    // marked it "hidden element" on its nearest visible ancestor, which is the
    // tool contradicting the setting the user had just turned off.
    const els = collectInteractive(
      root('<div data-nobox><a href="/x" data-n="empty"></a></div><a href="/y" data-n="real">Visible</a>'),
      false
    );

    expect(names(els)).toEqual(['real']);
  });

  it('is collected when the setting asks for hidden elements', () => {
    // The setting means what it says, and this is the kind of element it is
    // for — a menu that is collapsed until it is opened.
    const els = collectInteractive(
      root('<div data-nobox><a href="/x" data-n="empty"></a></div><a href="/y" data-n="real">Visible</a>'),
      true
    );

    expect(names(els)).toEqual(['empty', 'real']);
  });
});
