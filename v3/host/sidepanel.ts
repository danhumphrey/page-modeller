import { browser } from 'wxt/browser';
import type { PanelHost } from './types';

/**
 * Chrome side panel / Firefox sidebar. One instance per window, following
 * whichever tab is active — so the target tab changes under it.
 */
export function sidePanelHost(): PanelHost {
  const listeners: Array<(tabId: number | undefined) => void> = [];
  let last: number | undefined;

  async function getTabId() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  }

  // tabs.onActivated fires for every window, but `currentWindow` keeps the
  // answer scoped to ours — so announce only when the answer actually moves,
  // otherwise another window's tab switch would reset this panel.
  async function announce() {
    const tabId = await getTabId();
    if (tabId === last) return;
    last = tabId;
    for (const cb of listeners) cb(tabId);
  }

  browser.tabs.onActivated.addListener(announce);
  browser.windows.onFocusChanged.addListener(announce);

  return {
    kind: 'sidepanel',
    label: import.meta.env.FIREFOX ? 'Sidebar' : 'Side panel',
    async getTabId() {
      last = await getTabId();
      return last;
    },
    onTabChanged(cb) {
      listeners.push(cb);
    },
  };
}
