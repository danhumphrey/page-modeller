// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme } from '@/ui/theme';

/** What the hosts see as `browser`; each test sets the shape it is about. */
let api: Record<string, unknown> = {};
vi.mock('wxt/browser', () => ({
  browser: new Proxy({} as Record<string, unknown>, { get: (_t, key: string) => api[key] }),
}));

const { devtoolsHost } = await import('@/host/devtools');
const { sidePanelHost } = await import('@/host/sidepanel');

// SPEC §14: on the System setting a DevTools panel follows DEVTOOLS' theme,
// not the operating system's. They disagree whenever someone runs a light
// desktop with DevTools set to dark — a white panel inside a black DevTools,
// and the first thing a hand-test notices.

/** Enough of QVueGlobals for applyTheme, recording what Quasar was told. */
function fakeQuasar() {
  const dark = { set: vi.fn() };
  return { quasar: { dark } as never, dark };
}

const themeAttr = () => document.documentElement.getAttribute('data-pm-theme');

beforeEach(() => {
  document.documentElement.removeAttribute('data-pm-theme');
  api = {};
});

describe('applyTheme', () => {
  it('stamps an explicit choice, host theme or no host theme', () => {
    const { quasar, dark } = fakeQuasar();

    applyTheme(quasar, 'dark');
    expect(themeAttr()).toBe('dark');
    expect(dark.set).toHaveBeenLastCalledWith(true);

    // The user's own choice outranks the surface's.
    applyTheme(quasar, 'light', 'dark');
    expect(themeAttr()).toBe('light');
    expect(dark.set).toHaveBeenLastCalledWith(false);
  });

  it('resolves system through the host when the host knows', () => {
    const { quasar, dark } = fakeQuasar();

    applyTheme(quasar, 'system', 'dark');

    // Stamped rather than left to prefers-color-scheme, which would answer
    // for the desktop instead of for DevTools.
    expect(themeAttr()).toBe('dark');
    // And Quasar is told the same, or its dialogs and notifications paint to
    // the other theme.
    expect(dark.set).toHaveBeenLastCalledWith(true);
  });

  it('leaves system to prefers-color-scheme when the host has no opinion', () => {
    const { quasar, dark } = fakeQuasar();
    document.documentElement.setAttribute('data-pm-theme', 'dark');

    applyTheme(quasar, 'system');

    // Removed, not stamped: the CSS resolves it, and a leftover stamp would
    // pin the panel to whatever it last was.
    expect(themeAttr()).toBeNull();
    expect(dark.set).toHaveBeenLastCalledWith('auto');
  });
});

describe('hostTheme', () => {
  it('is DevTools’ theme in a DevTools panel', () => {
    api = { devtools: { panels: { themeName: 'dark' }, inspectedWindow: { tabId: 3 } } };
    expect(devtoolsHost().hostTheme()).toBe('dark');

    // Chrome answers 'default' for light; Firefox has answered 'light'. Only
    // 'dark' is matched, so both land on light rather than on undefined.
    api = { devtools: { panels: { themeName: 'default' }, inspectedWindow: { tabId: 3 } } };
    expect(devtoolsHost().hostTheme()).toBe('light');
    api = { devtools: { panels: { themeName: 'light' }, inspectedWindow: { tabId: 3 } } };
    expect(devtoolsHost().hostTheme()).toBe('light');
  });

  it('is undefined with no devtools API — the panel opened as a plain tab', () => {
    const host = devtoolsHost();

    expect(host.hostTheme()).toBeUndefined();
    // And subscribing must not throw where there is nothing to subscribe to.
    expect(() => host.onHostThemeChanged(() => {})).not.toThrow();
  });

  it('follows a Firefox theme change, where that event exists', () => {
    let fire: (() => void) | undefined;
    const panels = { themeName: 'light', onThemeChanged: { addListener: (cb: () => void) => (fire = cb) } };
    api = { devtools: { inspectedWindow: { tabId: 3 }, panels } };
    const host = devtoolsHost();
    const seen: Array<string | undefined> = [];

    host.onHostThemeChanged((t) => seen.push(t));
    panels.themeName = 'dark';
    fire?.();

    // Read again on the event, not captured at subscribe time.
    expect(seen).toEqual(['dark']);
  });

  it('is undefined for a side panel, which sits in the browser chrome', () => {
    api = {
      tabs: { onActivated: { addListener() {} }, onUpdated: { addListener() {} } },
      windows: { onFocusChanged: { addListener() {} } },
    };

    expect(sidePanelHost().hostTheme()).toBeUndefined();
  });
});
