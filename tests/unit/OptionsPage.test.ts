// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { Quasar, Dark, QToggle, QInput, QSelect } from 'quasar';
import OptionsPage from '../../ui/OptionsPage.vue';

// Every control's visible text is in a sibling element, so without an explicit
// association a screen reader announces "checkbox, unchecked" with no name —
// three times over, then an unlabelled field and an unlabelled combobox.

// Quasar's dark mode asks the browser what "auto" resolves to; jsdom has no
// matchMedia, and the rejection lands as an unhandled error rather than a
// failure, which is worse than a failure.
vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      sync: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
      onChanged: { addListener() {}, removeListener() {} },
    },
  },
}));

const mountPage = () =>
  mount(OptionsPage, {
    global: { plugins: [[Quasar, { plugins: { Dark } }]], components: { QToggle, QInput, QSelect } },
    attachTo: document.body,
  });

/**
 * The accessible name, resolved the way a screen reader resolves it: follow
 * `aria-labelledby` to the element it names and read its text.
 */
function accessibleName(el: Element): string {
  const id = el.getAttribute('aria-labelledby');
  if (id) return document.getElementById(id)?.textContent?.trim() ?? '';
  return el.getAttribute('aria-label')?.trim() ?? '';
}

describe('the options page', () => {
  it('gives every control an accessible name', async () => {
    const page = mountPage();
    await page.vm.$nextTick();

    const controls = page.element.querySelectorAll('[data-testid^="option-"]');
    // Four toggles, the test-id attribute field and the theme select.
    expect(controls).toHaveLength(6);

    for (const control of controls) {
      const testid = control.getAttribute('data-testid');
      expect(accessibleName(control), `${testid} has a name`).not.toBe('');
    }
    page.unmount();
  });

  it('names each control with the label shown next to it', async () => {
    const page = mountPage();
    await page.vm.$nextTick();

    const named = [...page.element.querySelectorAll('[data-testid^="option-"]')].map((c) => accessibleName(c));

    // Pointing at the visible text rather than repeating it in an aria-label
    // is what keeps these from drifting apart.
    expect(named).toContain('Theme');
    expect(named).toContain('Test ID attribute');
    expect(named).toContain('Show tooltips');
    expect(named).toContain('Model hidden elements');
    page.unmount();
  });

  it('puts the name on the focusable control, not on a wrapper', async () => {
    // Quasar decides where a fall-through attribute lands, and a name on an
    // outer div is a name on nothing: the switch, the field and the combobox
    // are what a screen reader stops on.
    const page = mountPage();
    await page.vm.$nextTick();

    const shape = [...page.element.querySelectorAll('[data-testid^="option-"]')].map(
      (el) => `${el.tagName} role=${el.getAttribute('role')} tabindex=${el.getAttribute('tabindex')}`
    );

    expect(shape).toEqual([
      'DIV role=switch tabindex=0',
      'DIV role=switch tabindex=0',
      'DIV role=switch tabindex=0',
      'DIV role=switch tabindex=0',
      'INPUT role=null tabindex=0',
      'INPUT role=combobox tabindex=0',
    ]);
    page.unmount();
  });

  it('points the description at the hint under each label', async () => {
    const page = mountPage();
    await page.vm.$nextTick();

    for (const control of page.element.querySelectorAll('[data-testid^="option-"]')) {
      const id = control.getAttribute('aria-describedby');
      expect(id, `${control.getAttribute('data-testid')} describedby`).toBeTruthy();
      expect(document.getElementById(id!)?.textContent?.trim()).not.toBe('');
    }
    page.unmount();
  });
});
