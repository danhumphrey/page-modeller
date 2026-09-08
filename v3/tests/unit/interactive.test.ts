// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { collectInteractive, isInteractiveRole } from '../../src/engine/interactive';

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
