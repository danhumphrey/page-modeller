import { browser } from 'wxt/browser';
import { isMessage, type Message } from '@/src/messaging';

// Background service worker / event page.
//
// Two jobs: opening the panel from the toolbar, and relaying panel → page
// messages. The relay exists because a DevTools page is not granted the `tabs`
// API — only devtools.*, runtime.* and a few others — so it cannot talk to a
// content script directly. Every surface goes through here, so there is one
// path rather than one per host.
export default defineBackground(() => {
  // Printed on startup so it is obvious which build is actually running. Both
  // browsers show background output in their browser console, unlike a DevTools
  // panel page, whose logs do not reliably surface anywhere convenient.
  console.log('[Page Modeller] background ready', import.meta.env.MODE, import.meta.env.BROWSER);

  browser.runtime.onMessage.addListener((msg: unknown) => {
    if (!isMessage(msg)) return;
    const m = msg as Message;
    if (m.type !== 'RELAY_TO_TAB') return;

    if (import.meta.env.DEV) console.log('[Page Modeller] relay', m.message.type, '→ tab', m.tabId);

    browser.tabs.sendMessage(m.tabId, m.message).catch((err) => {
      // No content script: a browser-internal page, the add-on store, or a tab
      // open before the extension loaded.
      console.error('[Page Modeller] relay failed', m.message.type, err);
      browser.runtime.sendMessage({ type: 'TAB_UNREACHABLE', tabId: m.tabId }).catch(() => {});
    });
  });

  if (import.meta.env.FIREFOX) {
    // sidebarAction.toggle() needs a user gesture — the action click is one.
    browser.action.onClicked.addListener(() => browser.sidebarAction.toggle());
    return;
  }

  // Chromium: let the action button open the side panel directly. Doing it this
  // way (rather than sidePanel.open) keeps the click a trusted user gesture.
  browser.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
