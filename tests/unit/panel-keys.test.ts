// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import * as quasar from 'quasar';
import { Quasar, Dark, Notify, ClosePopup } from 'quasar';
import App from '../../ui/App.vue';
import { emptyModel } from '../../src/model';
import { hostKey } from '../../host/types';

// After clicking Add Element focus is in the PANEL, so the page never sees the
// keydown — the panel forwards it as MOVE_TARGET / PICK_TARGET. Nothing
// covered that path: the E2E presses the keys in the page and sends
// MOVE_TARGET straight to the tab, so both ends were tested and the wire
// between them was not.

// QLayout observes its own size; jsdom has no ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);
vi.stubGlobal('matchMedia', () => ({ matches: false, media: '', onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));

/** Everything the panel sent to the background. */
let sent: Array<{ type: string; message?: { type: string; direction?: string } }> = [];
/** The panel's own runtime.onMessage handlers, so a test can drive them. */
let listeners: Array<(m: unknown) => void> = [];

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: (m: { type: string }) => {
        sent.push(m);
        return Promise.resolve();
      },
      onMessage: {
        addListener: (cb: (m: unknown) => void) => listeners.push(cb),
        removeListener: (cb: (m: unknown) => void) => {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        },
      },
      connect: () => ({ onDisconnect: { addListener() {} }, postMessage() {}, disconnect() {} }),
      getURL: (p: string) => `chrome-extension://test${p}`,
    },
    storage: {
      sync: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
      onChanged: { addListener() {}, removeListener() {} },
    },
  },
}));

const host = {
  kind: 'devtools' as const,
  label: 'DevTools',
  getTabId: async () => 7,
  onTabChanged() {},
  hostTheme: () => undefined,
  onHostThemeChanged() {},
};

let wrapper: ReturnType<typeof mount> | undefined;

async function openPanel() {
  wrapper = mount(App, {
    global: {
      plugins: [[Quasar, { plugins: { Dark, Notify } }]],
      // Every Q* component, so the dialogs really mount — a QDialog that never
      // renders cannot show whether the panel's key handler stands in its way.
      components: Object.fromEntries(
        Object.entries(quasar).filter(([name]) => /^Q[A-Z]/.test(name))
      ) as Record<string, unknown>,
      directives: { ClosePopup },
      provide: { [hostKey as symbol]: host },
    },
    attachTo: document.body,
  });
  // onMounted awaits loadSettings and getTabId before the panel knows its tab.
  await new Promise((r) => setTimeout(r, 0));
  await wrapper.vm.$nextTick();
  return wrapper;
}

/** Start picking the way the toolbar does. */
async function startAdding() {
  wrapper!.find('[data-testid="btn-add"]').trigger('click');
  await wrapper!.vm.$nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await wrapper!.vm.$nextTick();
}

const relayed = () => sent.filter((m) => m.type === 'RELAY_TO_TAB').map((m) => m.message!);

function press(key: string, target: Element = document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  sent = [];
  listeners = [];
});

afterEach(() => {
  vi.useRealTimers();
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
});

/** Deliver a background → panel message, as runtime.onMessage does. */
function fromBackground(message: object) {
  for (const cb of listeners) cb({ ...message, tabId: 7 });
}

describe('the scanning indicator ends with the SCAN, not the first model', () => {
  const busy = () => !!document.querySelector('[data-testid="scanning"]');

  it('stays up while frames are still reporting', async () => {
    // A scan fans out and every frame publishes its own haul, so the first
    // MODEL is the FIRST frame's finish. Clearing on it said the scan was over
    // while the rest of the tree was still working.
    await openPanel();
    fromBackground({ type: 'FROM_TAB', message: { type: 'SCAN_STARTED' } });
    await wrapper!.vm.$nextTick();
    expect(busy(), 'the scan has started').toBe(true);

    fromBackground({ type: 'MODEL', model: { ...emptyModel('playwright-ts'), elements: [] } });
    await wrapper!.vm.$nextTick();
    expect(busy(), 'a haul landed, but the scan is not over').toBe(true);
  });

  it('clears when the whole frame tree has reported', async () => {
    await openPanel();
    fromBackground({ type: 'FROM_TAB', message: { type: 'SCAN_STARTED' } });
    await wrapper!.vm.$nextTick();

    fromBackground({ type: 'FROM_TAB', message: { type: 'SCAN_COMPLETE' } });
    await wrapper!.vm.$nextTick();

    expect(busy()).toBe(false);
  });

  it('gives up on its own if completion never arrives', async () => {
    // A frame navigated away mid-scan never reports, and a spinner that never
    // stops is a worse failure than one that stops early.
    // Mounted on real timers — `openPanel` awaits one itself, and faking them
    // first means it never resolves.
    await openPanel();
    vi.useFakeTimers();
    fromBackground({ type: 'FROM_TAB', message: { type: 'SCAN_STARTED' } });
    await wrapper!.vm.$nextTick();
    expect(busy()).toBe(true);

    vi.advanceTimersByTime(60_000);
    await wrapper!.vm.$nextTick();
    expect(busy(), 'the ceiling let go').toBe(false);
  });
});

describe('the panel forwards the picking keys (SPEC §4)', () => {
  it('sends MOVE_TARGET for the arrows while picking', async () => {
    await openPanel();
    await startAdding();
    sent = [];

    press('ArrowUp');
    press('ArrowDown');

    expect(relayed().map((m) => `${m.type}:${m.direction ?? ''}`)).toEqual([
      'MOVE_TARGET:up',
      'MOVE_TARGET:down',
    ]);
  });

  it('sends PICK_TARGET for Enter', async () => {
    await openPanel();
    await startAdding();
    sent = [];

    press('Enter');

    expect(relayed().map((m) => m.type)).toEqual(['PICK_TARGET']);
  });

  it('still walks the DOM while the guidance dialog is open', async () => {
    // The dialog opens on FIRST use of each mode (SPEC §4) — so it is on
    // screen at exactly the moment you reach for the arrows, and it is the
    // thing telling you to use them. In a real browser Quasar focuses it, so
    // every keydown arrives with a target inside `.q-dialog`.
    await openPanel();
    await startAdding();
    await wrapper!.vm.$nextTick();

    const dialog = document.querySelector('.q-dialog');
    expect(dialog, 'the guidance dialog is open on first use').not.toBeNull();
    sent = [];

    press('ArrowUp', dialog!);

    expect(relayed().map((m) => `${m.type}:${m.direction ?? ''}`)).toEqual(['MOVE_TARGET:up']);
  });

  it('leaves Escape and Enter to a dialog that has focus', async () => {
    // The other half: Escape closes the dialog rather than stopping the pick,
    // and Enter activates the focused button rather than committing whatever
    // the pointer happens to be over.
    await openPanel();
    await startAdding();
    await wrapper!.vm.$nextTick();
    const dialog = document.querySelector('.q-dialog')!;
    sent = [];

    press('Escape', dialog);
    press('Enter', dialog);

    expect(relayed(), 'the dialog owns the keys it uses').toEqual([]);
  });

  it('sends nothing when no pick is armed', async () => {
    await openPanel();
    sent = [];

    press('ArrowUp');

    expect(relayed()).toEqual([]);
  });
});
