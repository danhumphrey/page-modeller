// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { Quasar, QToolbar, QBtn, QIcon, QMenu, QList, QItem, QItemSection, QTooltip, QSpace } from 'quasar';
import AppToolbar from '../../ui/AppToolbar.vue';

// The toolbar's enablement IS its main signal (SPEC §3), and nothing covered
// it. The framework lock is the one with consequences: locator types are
// framework-specific, so a model built for Playwright and re-read as Selenium
// shows rows whose locators that framework cannot express.

let wrapper: ReturnType<typeof mount> | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function render(state: Partial<{ hasModel: boolean; isScanning: boolean; isAdding: boolean }> = {}) {
  wrapper = mount(AppToolbar, {
    props: {
      frameworkId: 'playwright-ts',
      hasModel: false,
      isScanning: false,
      isAdding: false,
      showTooltips: false,
      ...state,
    },
    global: {
      plugins: [Quasar],
      components: { QToolbar, QBtn, QIcon, QMenu, QList, QItem, QItemSection, QTooltip, QSpace },
    },
  });
  return wrapper;
}

/** Quasar marks a disabled QBtn with a class rather than the attribute. */
const disabled = (testid: string) => {
  const el = wrapper!.element.querySelector(`[data-testid="${testid}"]`);
  expect(el, testid).not.toBeNull();
  return el!.classList.contains('disabled') || el!.hasAttribute('disabled');
};

describe('the framework selector (SPEC §3)', () => {
  it('is open while the model is empty', () => {
    render();
    expect(disabled('framework-selector')).toBe(false);
  });

  it('locks once the model has an element', () => {
    // The lock is the point: the locator types offered are chosen per
    // framework, so switching after the fact leaves rows carrying candidates
    // the new framework cannot express.
    render({ hasModel: true });
    expect(disabled('framework-selector')).toBe(true);
  });

  it('locks while picking, even with nothing modelled yet', () => {
    // The first pick is about to arrive and will be ranked for whichever
    // framework is selected now.
    render({ isAdding: true });
    expect(disabled('framework-selector')).toBe(true);
    render({ isScanning: true });
    expect(disabled('framework-selector')).toBe(true);
  });

  it('names the framework it is locked to', () => {
    // A locked control that does not say what it is locked to is just a dead
    // button. The menu itself is driven in the extension E2E, where Quasar's
    // teleported popup is a real one.
    render({ hasModel: true });
    expect(wrapper!.element.querySelector('[data-testid="framework-selector"]')!.textContent).toContain(
      'Playwright'
    );
  });
});

describe('names for assistive technology', () => {
  it('names every icon-only toolbar button', () => {
    // Nothing else names them: they carry an icon and a tooltip, and the
    // tooltip is a SETTING — with it off there is no text in the subtree at
    // all — and a tooltip is not a persistent name even when it is on.
    render();

    const named = [...wrapper!.element.querySelectorAll('[data-testid^="btn-"]')].map((el) => [
      el.getAttribute('data-testid'),
      el.getAttribute('aria-label'),
    ]);

    expect(named).toEqual([
      ['btn-scan', 'Scan Page'],
      ['btn-delete-model', 'Delete Model'],
      ['btn-add', 'Add Element'],
      ['btn-help', 'Picking Guidance'],
      ['btn-generate', 'Generate Code'],
    ]);
  });

  it('keeps the name when tooltips are turned off', () => {
    // The case that makes the tooltip useless as a name.
    wrapper = mount(AppToolbar, {
      props: {
        frameworkId: 'playwright-ts',
        hasModel: true,
        isScanning: false,
        isAdding: false,
        showTooltips: false,
      },
      global: {
        plugins: [Quasar],
        components: { QToolbar, QBtn, QIcon, QMenu, QList, QItem, QItemSection, QTooltip, QSpace },
      },
    });

    for (const el of wrapper.element.querySelectorAll('[data-testid^="btn-"]')) {
      expect(el.getAttribute('aria-label'), el.getAttribute('data-testid') ?? '').toBeTruthy();
    }
  });
});

describe('the rest of the toolbar (SPEC §3)', () => {
  it('disables Scan and enables Add while the model is empty', () => {
    render();
    expect(disabled('btn-scan')).toBe(false);
    expect(disabled('btn-add')).toBe(false);
    // Nothing to delete or generate from.
    expect(disabled('btn-delete-model')).toBe(true);
    expect(disabled('btn-generate')).toBe(true);
  });

  it('turns Scan off and Delete/Generate on once a model exists', () => {
    // Scan is once per model (SPEC §4), so it locks with the framework.
    render({ hasModel: true });
    expect(disabled('btn-scan')).toBe(true);
    expect(disabled('btn-delete-model')).toBe(false);
    expect(disabled('btn-generate')).toBe(false);
  });

  it('keeps help reachable in every state', () => {
    // The one control whose whole job is to explain what is happening.
    render({ hasModel: true, isScanning: true });
    expect(disabled('btn-help')).toBe(false);
  });

  it('disables Add during a scan, and Delete and Generate while picking', () => {
    render({ hasModel: true, isScanning: true });
    expect(disabled('btn-add')).toBe(true);
    expect(disabled('btn-delete-model')).toBe(true);
    expect(disabled('btn-generate')).toBe(true);
  });
});
