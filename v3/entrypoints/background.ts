import { browser } from 'wxt/browser';

// Background service worker / event page. The toolbar click is the only way in
// to the side panel on Chrome and the quickest one to the sidebar on Firefox,
// so it lives here; the DevTools panel registers itself via devtools.html.
// Content ↔ panel messaging goes direct over runtime/tabs, so nothing else does.
export default defineBackground(() => {
  if (import.meta.env.FIREFOX) {
    // sidebarAction.toggle() needs a user gesture — the action click is one.
    browser.action.onClicked.addListener(() => browser.sidebarAction.toggle());
    return;
  }

  // Chromium: let the action button open the side panel directly. Doing it this
  // way (rather than sidePanel.open) keeps the click a trusted user gesture.
  browser.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
