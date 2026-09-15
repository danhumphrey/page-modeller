import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emptyModel } from '@/src/model';

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
  updated: [] as Listener[],
  message: [] as Listener[],
};

/** Everything the background sent to panels via runtime.sendMessage. */
const broadcast: Array<{ type: string; tabId?: number; message?: { type: string } }> = [];

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
      onMessage: { addListener: (cb: Listener) => listeners.message.push(cb) },
      onInstalled: { addListener: (cb: Listener) => listeners.installed.push(cb) },
      sendMessage: (message: { type: string }) => {
        broadcast.push(message);
        return Promise.resolve();
      },
      getURL: (path: string) => `chrome-extension://test${path}`,
      getManifest: () => ({ version: manifestVersion }),
    },
    tabs: {
      sendMessage: (tabId: number, message: { type: string }) => {
        sentToTabs.push({ tabId, message });
        return Promise.resolve();
      },
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: (cb: Listener) => listeners.updated.push(cb) },
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
  listeners.updated.length = 0;
  listeners.message.length = 0;
  broadcast.length = 0;
  sentToTabs.length = 0;
  tabsCreated.length = 0;
  manifestVersion = '3.0.0';
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];
  vi.resetModules();
  const mod = await import('@/entrypoints/background');
  (mod.default as unknown as () => void)();
}

const stopsSentTo = (tabId: number) => sentToTabs.filter((s) => s.tabId === tabId && s.message.type === 'STOP_PICKING');

/** Seed a model for `tabId`, as picking an element would. */
function seedModel(tabId: number, url = 'https://example.test/one') {
  const models = (sessionStore.models ??= {}) as Record<number, unknown>;
  models[tabId] = { ...emptyModel('playwright-ts'), url, elements: [{ name: 'field' }] };
}

const modelledTabs = () => Object.keys((sessionStore.models ?? {}) as object).map(Number).sort();

/** Drive `tabs.onUpdated`, as a navigation does. */
async function navigate(tabId: number, url: string) {
  for (const cb of listeners.updated) await cb(tabId, { url });
  await flush();
}

/** Let the store's serialised queue drain. */
const flush = () => new Promise((r) => setTimeout(r, 0));

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

describe('re-broadcasting what a frame said (FROM_TAB)', () => {
  beforeEach(startBackground);

  /** Deliver a content-script message, as runtime.onMessage does. */
  const fromContent = (message: object, sender: object) => {
    for (const cb of listeners.message) cb(message, sender);
  };

  const relayed = () => broadcast.filter((m) => m.type === 'FROM_TAB');

  it('stamps the sending tab, because Firefox does not', () => {
    // A content script's runtime.sendMessage arrives at a Firefox DevTools
    // page with no `sender.tab` at all, so a panel filtering on it would drop
    // every message. The background always sees the sender, so it stamps the
    // tab and re-broadcasts; panels filter on that instead.
    fromContent({ type: 'HIGHLIGHT_RESULT', count: 2, hidden: 0 }, { tab: { id: 7 } });

    expect(relayed()).toHaveLength(1);
    expect(relayed()[0].tabId, 'the tab the content script is in').toBe(7);
    expect(relayed()[0].message?.type).toBe('HIGHLIGHT_RESULT');
  });

  it('says nothing when it cannot tell which tab it came from', () => {
    // Unstamped, the message would reach every panel and each would have to
    // guess — and a panel on another tab showing another tab's frame warning
    // is worse than showing nothing.
    fromContent({ type: 'HIGHLIGHT_RESULT', count: 2, hidden: 0 }, {});
    fromContent({ type: 'FRAME_UNREADABLE', sandboxed: true }, { tab: {} });

    expect(relayed()).toHaveLength(0);
  });

  it('ignores a message it does not recognise', () => {
    fromContent({ type: 'NOT_OURS' }, { tab: { id: 7 } });
    fromContent({ nope: true }, { tab: { id: 7 } });
    fromContent(null as unknown as object, { tab: { id: 7 } });

    expect(relayed()).toHaveLength(0);
  });

  it('relays each of the notices a frame can raise', () => {
    // Every one of these is a frame saying it could not do what was asked, and
    // each has its own snackbar in the panel. A missing case here is silence.
    fromContent({ type: 'FRAME_UNREADABLE', sandboxed: false }, { tab: { id: 7 } });
    fromContent({ type: 'SHADOW_UNREADABLE', count: 3 }, { tab: { id: 7 } });
    fromContent({ type: 'PICKING_STOPPED' }, { tab: { id: 7 } });

    expect(relayed().map((m) => m.message?.type)).toEqual([
      'FRAME_UNREADABLE',
      'SHADOW_UNREADABLE',
      'PICKING_STOPPED',
    ]);
    expect(new Set(relayed().map((m) => m.tabId))).toEqual(new Set([7]));
  });
});

describe('a haul from a session that is over (SPEC §4)', () => {
  beforeEach(startBackground);

  const fromContent = (message: object, sender: object) => {
    for (const cb of listeners.message) cb(message, sender);
  };

  /** Arm a picking session on a tab, the way the panel does. */
  const startPicking = (tabId: number, nonce: string) =>
    fromContent({ type: 'RELAY_TO_TAB', tabId, message: { type: 'START_PICKING', mode: 'scan', nonce } }, {});

  const haul = (tabId: number, nonce: string | undefined, name: string) =>
    fromContent(
      {
        type: 'ELEMENTS_PICKED',
        nonce,
        results: [{ suggestedName: name, candidates: [], preferredIndex: 0, role: null, tag: 'input' }],
      },
      { tab: { id: tabId, url: 'https://example.test/one' } }
    );

  const names = async () => {
    await flush();
    const models = (sessionStore.models ?? {}) as Record<number, { elements: { name: string }[] }>;
    return models[7]?.elements.map((e) => e.name) ?? [];
  };

  it('accepts a haul from the session that is running', async () => {
    startPicking(7, 'n1');
    haul(7, 'n1', 'Email');

    expect(await names()).toEqual(['Email']);
  });

  it('drops a haul from a session that has ended', async () => {
    // The shape that matters: a scan fans out, the user presses Delete Model
    // while a frame is still working, and that frame's haul arrives after.
    // Putting the model back with a fraction of its rows is worse than either
    // keeping it whole or losing it.
    startPicking(7, 'n1');
    haul(7, 'n1', 'Email');
    await flush();

    fromContent({ type: 'DELETE_MODEL', tabId: 7 }, {});
    await flush();
    haul(7, 'n1', 'LateFromAFrame');

    expect(await names(), 'the deleted model stays deleted').toEqual([]);
  });

  it('drops a haul from a previous session', async () => {
    startPicking(7, 'n1');
    startPicking(7, 'n2');

    haul(7, 'n1', 'Stale');
    haul(7, 'n2', 'Current');

    expect(await names()).toEqual(['Current']);
  });

  it('accepts a haul that names no session at all', async () => {
    // A frame that never saw a START_PICKING, or a message from across an
    // extension reload. Refusing it would be a regression for anything
    // mid-flight, and the nonce is an anti-revival guard, not authentication.
    haul(7, undefined, 'Unversioned');

    expect(await names()).toEqual(['Unversioned']);
  });
});

describe('navigation (SPEC §7)', () => {
  beforeEach(startBackground);

  it('does not create a model for a tab that has none', async () => {
    // `tabs.onUpdated` fires for every URL change in every tab, panel or no
    // panel. Reading through `mutate` created on read, so ordinary browsing
    // woke the worker and left an empty record behind for each tab visited.
    await navigate(4, 'https://example.test/somewhere');

    expect(modelledTabs()).toEqual([]);
  });

  it('still marks an existing model stale when its tab navigates away', async () => {
    seedModel(7, 'https://example.test/one');

    await navigate(7, 'https://example.test/two');

    const models = sessionStore.models as Record<number, { stale: boolean }>;
    expect(models[7].stale).toBe(true);
  });

  it('clears stale when the tab comes back to where the model was built', async () => {
    seedModel(7, 'https://example.test/one');

    await navigate(7, 'https://example.test/two');
    await navigate(7, 'https://example.test/one');

    const models = sessionStore.models as Record<number, { stale: boolean }>;
    expect(models[7].stale).toBe(false);
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

  it('opens for a 2.x user landing on a later 3.x patch', () => {
    // The gate is on the MAJOR version, not on arriving exactly at 3.0.0. A
    // user who never installed 3.0.0 — because a patch shipped before their
    // browser got round to updating them — has just as much to catch up on.
    manifestVersion = '3.0.1';
    install('update', '2.5.1');
    expect(tabsCreated).toEqual(['chrome-extension://test/whatsnew.html']);
  });

  it('opens for a 2.x user landing on a much later 3.x release', () => {
    manifestVersion = '3.4.2';
    install('update', '2.1.0');
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
