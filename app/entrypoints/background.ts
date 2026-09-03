// Background service worker. Opens the side panel when the toolbar icon is
// clicked (Chrome). Messaging between content script and panel goes direct via
// runtime/tabs, so the background stays minimal.
export default defineBackground(() => {
  // chrome.sidePanel is Chromium-only; guard so the Firefox build doesn't throw.
  const sp = (globalThis as { chrome?: { sidePanel?: { setPanelBehavior?: (o: { openPanelOnActionClick: boolean }) => Promise<void> } } }).chrome
    ?.sidePanel;
  sp?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});
