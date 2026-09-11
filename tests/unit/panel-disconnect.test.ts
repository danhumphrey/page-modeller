import { describe, it, expect, beforeEach, vi } from 'vitest';

// The background's panel lifecycle (SPEC §5), which nothing else covers.
//
// Closing the last panel on a tab ends the session: the model is dropped AND
// the page is disarmed. The second half was missing — picking lives in the
// content script, which never learns that a panel closed, so it went on
// drawing the overlay and swallowing clicks with nothing left to receive them.
//
// Driven through the real module rather than a reimplementation of it: the bug
// was a missing call inside `onDisconnect`, and only the real listener can
// show whether it is there.

type Listener = (...args: unknown[]) => unknown;

/** A captured `runtime.onConnect` port, driveable from the test. */
interface FakePort {
  name: string;
  onMessage: { addListener(cb: Listener): void };
  onDisconnect: { addListener(cb: Listener): void };
  /** Say which tab this panel is showing, as a real panel does on connect. */
  watch(tabId: number): void;
  /** Close the panel. */
  disconnect(): void;
}

const listeners = {
  connect: [] as Listener[],
};

const sentToTabs: Array<{ tabId: number; message: { type: string } }> = [];

/**
 * storage.session, backed by a plain object. ModelStore reads and writes it,
 * and the disconnect path clears through it.
 */
const sessionStore: Record<string, unknown> = {};

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onConnect: { addListener: (cb: Listener) => listeners.connect.push(cb) },
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      sendMessage: () => Promise.resolve(),
      getURL: (path: string) => `chrome-extension://test${path}`,
    },
    tabs: {
      sendMessage: (tabId: number, message: { type: string }) => {
        sentToTabs.push({ tabId, message });
        return Promise.resolve();
      },
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
      query: () => Promise.resolve([]),
      create: () => Promise.resolve({}),
    },
    action: { onClicked: { addListener: () => {} } },
    contextMenus: { create: () => {}, onClicked: { addListener: () => {} }, removeAll: () => Promise.resolve() },
    sidePanel: { setPanelBehavior: () => Promise.resolve() },
    sidebarAction: { toggle: () => {} },
    storage: {
      session: {
        get: (key: string) => Promise.resolve({ [key]: sessionStore[key] }),
        set: (items: Record<string, unknown>) => {
          Object.assign(sessionStore, items);
          return Promise.resolve();
        },
        remove: (key: string) => {
          delete sessionStore[key];
          return Promise.resolve();
        },
      },
      sync: { get: () => Promise.resolve({}) },
      onChanged: { addListener: () => {} },
    },
  },
}));

/** WXT injects this; outside the build it has to be supplied. */
vi.stubGlobal('defineBackground', (fn: () => void) => fn);

function connectPanel(): FakePort {
  let onDisconnect: Listener = () => {};
  let onMessage: Listener = () => {};
  const port: FakePort = {
    name: 'page-modeller-panel',
    onMessage: { addListener: (cb) => (onMessage = cb) },
    onDisconnect: { addListener: (cb) => (onDisconnect = cb) },
    watch: (tabId) => onMessage({ tabId }),
    disconnect: () => onDisconnect(),
  };
  for (const cb of listeners.connect) cb(port);
  return port;
}

/** Fresh module state per test — the background holds its ports in a closure. */
async function startBackground() {
  listeners.connect.length = 0;
  sentToTabs.length = 0;
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];
  vi.resetModules();
  const mod = await import('@/entrypoints/background');
  (mod.default as unknown as () => void)();
}

const stopsSentTo = (tabId: number) => sentToTabs.filter((s) => s.tabId === tabId && s.message.type === 'STOP_PICKING');

describe('closing the last panel on a tab', () => {
  beforeEach(startBackground);

  it('disarms the picker in the page', async () => {
    const panel = connectPanel();
    panel.watch(7);

    panel.disconnect();

    // Without this the content script stays armed with nothing listening: the
    // overlay follows the pointer and the next click is swallowed.
    expect(stopsSentTo(7)).toHaveLength(1);
  });

  it('leaves the page armed while another panel is still watching that tab', async () => {
    const sidebar = connectPanel();
    const devtools = connectPanel();
    sidebar.watch(7);
    devtools.watch(7);

    sidebar.disconnect();

    // The DevTools panel can still receive the pick, so picking must survive.
    expect(stopsSentTo(7)).toHaveLength(0);

    devtools.disconnect();
    expect(stopsSentTo(7)).toHaveLength(1);
  });

  it('does not disarm a different tab', async () => {
    const a = connectPanel();
    const b = connectPanel();
    a.watch(7);
    b.watch(9);

    a.disconnect();

    expect(stopsSentTo(7)).toHaveLength(1);
    expect(stopsSentTo(9)).toHaveLength(0);
  });

  it('does nothing for a panel that never reported a tab', async () => {
    const panel = connectPanel();

    panel.disconnect();

    expect(sentToTabs).toHaveLength(0);
  });
});
