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
  installed: [] as Listener[],
};

/** Tabs the background opened of its own accord. */
const tabsCreated: string[] = [];

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
      onInstalled: { addListener: (cb: Listener) => listeners.installed.push(cb) },
      sendMessage: () => Promise.resolve(),
      getURL: (path: string) => `chrome-extension://test${path}`,
      getManifest: () => ({ version: manifestVersion }),
    },
    tabs: {
      sendMessage: (tabId: number, message: { type: string }) => {
        sentToTabs.push({ tabId, message });
        return Promise.resolve();
      },
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
      query: () => Promise.resolve([]),
      create: (opts: { url?: string }) => {
        tabsCreated.push(opts?.url ?? '');
        return Promise.resolve({});
      },
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

/** What `runtime.getManifest().version` answers; a test may move it. */
let manifestVersion = '3.0.0';

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
  listeners.installed.length = 0;
  sentToTabs.length = 0;
  tabsCreated.length = 0;
  manifestVersion = '3.0.0';
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

describe("the what's new tab (SPEC §20)", () => {
  beforeEach(startBackground);

  const install = (reason: string, previousVersion?: string) => {
    for (const cb of listeners.installed) cb({ reason, previousVersion });
  };

  it('opens once when the major version goes up', () => {
    install('update', '2.5.1');
    expect(tabsCreated).toEqual(['chrome-extension://test/whatsnew.html']);
  });

  it('stays shut for a minor or patch release', () => {
    // 3.0.1 has nothing a user needs to be told in a tab, and a tab per patch
    // is how an extension earns a one-star review.
    install('update', '3.0.0');
    manifestVersion = '3.1.0';
    install('update', '3.0.0');
    expect(tabsCreated).toEqual([]);
  });

  it('stays shut when an unpacked extension is reloaded', () => {
    // Chrome fires `update` with the SAME version on every reload, which is
    // every rebuild in dev. Ungated this opens a tab on every save.
    install('update', '3.0.0');
    expect(tabsCreated).toEqual([]);
  });

  it('stays shut on a fresh install', () => {
    // Nothing to catch up on, and no previousVersion to compare. The store
    // listing is the onboarding.
    install('install', undefined);
    expect(tabsCreated).toEqual([]);
  });

  it('stays shut for a browser update', () => {
    install('chrome_update', '3.0.0');
    expect(tabsCreated).toEqual([]);
  });

  it('does not trip over a version it cannot parse', () => {
    install('update', 'not-a-version');
    expect(tabsCreated).toEqual([]);
  });

  it('does not fire on a downgrade', () => {
    manifestVersion = '2.5.1';
    install('update', '3.0.0');
    expect(tabsCreated).toEqual([]);
  });
});
