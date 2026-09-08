// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { describeElement } from '../../src/engine/describe';

function el(html: string, sel = '[data-t]'): Element {
  document.body.innerHTML = html;
  const found = document.querySelector(sel);
  if (!found) throw new Error(`no match for ${sel}`);
  return found;
}

describe('describeElement', () => {
  it('leads with the role and the accessible name', () => {
    expect(describeElement(el('<button data-t>Save</button>'))).toBe('button "Save"');
  });

  it('shows the tag when it differs from the role', () => {
    // The case this exists for: a wrapper <div> and the <div role="button">
    // inside it have the same bounding box and both used to read "div".
    expect(describeElement(el('<div role="button" data-t>Log in</div>'))).toBe('button (div) "Log in"');
  });

  it('shows the tag alone for a plain wrapper', () => {
    expect(describeElement(el('<div data-t><span>x</span></div>'))).toBe('div');
  });

  it('ignores role="none" and presentation, which describe nothing', () => {
    expect(describeElement(el('<div role="none" data-t></div>'))).toBe('div');
    expect(describeElement(el('<div role="presentation" data-t></div>'))).toBe('div');
  });

  it('truncates a long accessible name', () => {
    const label = describeElement(el('<button data-t>Download the quarterly revenue report for 2026</button>'));
    expect(label).toBe('button "Download the quarterly revenu…"');
    expect(label.length).toBeLessThan(45);
  });

  it('omits the name when there is none', () => {
    expect(describeElement(el('<input type="text" data-t />'))).toBe('textbox (input)');
  });

  it('uses an explicit label over content', () => {
    expect(describeElement(el('<button aria-label="Close dialog" data-t>×</button>'))).toBe('button "Close dialog"');
  });
});
