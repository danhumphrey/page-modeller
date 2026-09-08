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
  async function announce(reason: string) {
    const tabId = await getTabId();
    if (import.meta.env.DEV) console.log('[Page Modeller] side panel', reason, '→ tab', tabId, tabId === last ? '(unchanged)' : '(changed)');
    if (tabId === last) return;
    last = tabId;
    for (const cb of listeners) cb(tabId);
  }

  // The standard trio for following the active tab from a side panel. onUpdated
  // is not redundant: a tab can become the one we should be showing without
  // onActivated firing — a fresh tab that then navigates, for instance.
  browser.tabs.onActivated.addListener(() => announce('tabs.onActivated'));
  browser.tabs.onUpdated.addListener((_id, _change, tab) => {
    if (tab.active) void announce('tabs.onUpdated');
  });
  browser.windows.onFocusChanged.addListener(() => announce('windows.onFocusChanged'));

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
