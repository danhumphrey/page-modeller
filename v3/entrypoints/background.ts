import { browser } from 'wxt/browser';
import { isMessage, PANEL_PORT, type Message } from '@/src/messaging';
import { ModelStore, usedNames, type TabModel } from '@/src/model';
import { uniqueName } from '@/src/engine/naming';
import { defaultFrameworkId } from '@/src/frameworks';

// Background service worker / event page.
//
// Owns the model — one per tab (SPEC §5) — and relays messages in both
// directions. Both exist because the panel cannot do them itself:
//
//   * A DevTools page is granted only devtools.*, runtime.* and a few others.
//     `browser.tabs` is undefined there, so a panel cannot talk to a content
//     script; it sends RELAY_TO_TAB instead.
//   * Firefox does not populate `sender.tab` for a message delivered to a
//     DevTools page, so a panel cannot tell which tab a pick came from. The
//     background always sees the sender, and stamps it.
//   * A model held in a panel is one model per *panel*: a sidebar and a
//     DevTools panel on the same tab showed different rows.
export default defineBackground(() => {
  console.log('[Page Modeller] background ready', import.meta.env.MODE, import.meta.env.BROWSER);

  const store = new ModelStore(defaultFrameworkId);
  let idSeq = 0;

  /** Every panel gets the model; each ignores tabs that are not its own. */
  function publish(tabId: number, model: TabModel) {
    browser.runtime.sendMessage({ type: 'MODEL', tabId, model }).catch(() => {});
  }

  browser.tabs.onRemoved.addListener((tabId) => store.clear(tabId));

  // A model with no panel attached is abandoned work, so the last panel closing
  // ends the session and drops everything. Ports are how the background can
  // tell: onDisconnect fires when the page goes away, which covers closing the
  // sidebar, closing DevTools, and the tab hosting them being closed.
  //
  // Deliberately not per-tab. A side panel follows the active tab, so a
  // per-tab port would drop tab A's model the moment you looked at tab B —
  // switching away and back must not lose work (SPEC §5).
  const panels = new Set<{ onDisconnect: { addListener(cb: () => void): void } }>();

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PANEL_PORT) return;
    panels.add(port);
    port.onDisconnect.addListener(() => {
      panels.delete(port);
      if (panels.size > 0) return;
      const dropped = store.tabIds();
      store.clearAll();
      // Anything still listening should show an empty table rather than stale
      // rows, in the window before it too goes away.
      for (const tabId of dropped) publish(tabId, store.get(tabId));
    });
  });

  browser.runtime.onMessage.addListener((msg: unknown, sender: { tab?: { id?: number } }) => {
    if (!isMessage(msg)) return;
    const m = msg as Message;

    switch (m.type) {
      // ---- from a content script ----
      case 'ELEMENT_PICKED': {
        const tabId = sender.tab?.id;
        if (tabId == null) return;
        const model = store.get(tabId);
        model.elements.push({
          ...m.result,
          id: `el-${idSeq++}`,
          name: uniqueName(m.result.suggestedName, usedNames(model)),
          selectedIndex: m.result.preferredIndex >= 0 ? m.result.preferredIndex : 0,
        });
        publish(tabId, model);
        // Picking is one-shot (SPEC §4); tell the panels so they can un-arm.
        browser.runtime.sendMessage({ type: 'FROM_TAB', tabId, message: { type: 'PICKING_STOPPED' } }).catch(() => {});
        return;
      }
      case 'PICKING_STOPPED':
      case 'HIGHLIGHT_RESULT': {
        const tabId = sender.tab?.id;
        if (tabId == null) return;
        browser.runtime.sendMessage({ type: 'FROM_TAB', tabId, message: m }).catch(() => {});
        return;
      }

      // ---- from a panel ----
      case 'RELAY_TO_TAB': {
        if (import.meta.env.DEV) console.log('[Page Modeller] relay', m.message.type, '→ tab', m.tabId);
        browser.tabs.sendMessage(m.tabId, m.message).catch((err) => {
          // No content script: a browser-internal page, the add-on store, or a
          // tab open before the extension loaded.
          console.error('[Page Modeller] relay failed', m.message.type, err);
          browser.runtime.sendMessage({ type: 'TAB_UNREACHABLE', tabId: m.tabId }).catch(() => {});
        });
        return;
      }
      case 'GET_MODEL':
        publish(m.tabId, store.get(m.tabId));
        return;
      case 'DELETE_ELEMENT': {
        const model = store.get(m.tabId);
        model.elements = model.elements.filter((e) => e.id !== m.id);
        publish(m.tabId, model);
        return;
      }
      case 'DELETE_MODEL':
        store.clear(m.tabId);
        publish(m.tabId, store.get(m.tabId));
        return;
      case 'SET_FRAMEWORK': {
        const model = store.get(m.tabId);
        model.frameworkId = m.frameworkId;
        publish(m.tabId, model);
        return;
      }
    }
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
