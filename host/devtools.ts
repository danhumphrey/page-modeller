import { browser } from 'wxt/browser';
import type { PanelHost } from './types';

/** DevTools panel. Bound for its whole lifetime to the tab it was opened on. */
export function devtoolsHost(): PanelHost {
  // Outside a real DevTools window there is no `devtools` API — opening
  // devtools-panel.html directly as a tab is the case that hits this. Render
  // the UI anyway with no target tab rather than failing to mount.
  const tabId = browser.devtools?.inspectedWindow?.tabId;

  return {
    kind: 'devtools',
    label: tabId == null ? 'DevTools (detached)' : 'DevTools',
    getTabId: async () => tabId,
    onTabChanged() {
      // A DevTools panel never changes tab.
    },
  };
}
