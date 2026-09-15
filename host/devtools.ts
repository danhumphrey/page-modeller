import { browser } from 'wxt/browser';
import type { PanelHost } from './types';

/** DevTools panel. Bound for its whole lifetime to the tab it was opened on. */
export function devtoolsHost(): PanelHost {
  // Outside a real DevTools window there is no `devtools` API — opening
  // devtools-panel.html directly as a tab is the case that hits this. Render
  // the UI anyway with no target tab rather than failing to mount.
  const tabId = browser.devtools?.inspectedWindow?.tabId;

  /**
   * DevTools' own theme. Both browsers spell it `themeName`; both answer
   * 'dark' or 'default', and Firefox has answered 'light' in the past, so
   * anything that is not 'dark' is treated as light rather than matched
   * against a list.
   *
   * Optional-chained throughout for the detached case above, where there is no
   * `devtools` API at all.
   */
  const themeOf = (): 'dark' | 'light' | undefined => {
    const name = browser.devtools?.panels?.themeName;
    return name == null ? undefined : name === 'dark' ? 'dark' : 'light';
  };

  return {
    kind: 'devtools',
    label: tabId == null ? 'DevTools (detached)' : 'DevTools',
    getTabId: async () => tabId,
    onTabChanged() {
      // A DevTools panel never changes tab.
    },
    hostTheme: themeOf,
    onHostThemeChanged(cb) {
      // Firefox fires this; Chrome has no equivalent, so there the theme is
      // read once and a change needs DevTools reopened. Guarded rather than
      // branched on the browser, because the guard is what is actually true.
      browser.devtools?.panels?.onThemeChanged?.addListener?.(() => cb(themeOf()));
    },
  };
}
