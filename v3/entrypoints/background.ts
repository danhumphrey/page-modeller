import { browser } from 'wxt/browser';
import { isMessage, PANEL_PORT, type Message, type PanelViewing } from '@/src/messaging';
import { ModelStore, usedNames, type TabModel } from '@/src/model';
import { uniqueName } from '@/src/engine/naming';
import { defaultFrameworkId } from '@/src/frameworks';
import { chooseCandidate } from '@/src/locators/select';

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

  // A model kept across a navigation may no longer describe the page (SPEC §5).
  // The background has to notice: a DevTools panel cannot read the tab's URL.
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    const model = store.get(tabId);
    if (model.url == null) return;
    const stale = model.url !== changeInfo.url;
    if (stale === model.stale) return;
    // Navigating back to where it was built makes it current again.
    model.stale = stale;
    publish(tabId, model);
  });

  // A model with no panel watching it is abandoned work (SPEC §5). Each panel
  // holds a port and reports which tab it is showing; when a panel closes, the
  // tab it was on loses its model unless another panel is still on that tab.
  //
  // Evaluated on DISCONNECT, never on a tab change. A side panel follows the
  // active tab, so dropping whenever no panel is watching would lose tab A's
  // model the moment you looked at tab B. Switching away and back must not
  // lose work; closing the panel is what ends it.
  type PanelPort = { onDisconnect: { addListener(cb: () => void): void } };
  const viewing = new Map<PanelPort, number | undefined>();

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PANEL_PORT) return;
    viewing.set(port, undefined);

    port.onMessage.addListener((msg: unknown) => {
      const tabId = (msg as PanelViewing)?.tabId;
      if (import.meta.env.DEV) console.log('[Page Modeller] panel now watching tab', tabId);
      viewing.set(port, tabId);
    });

    port.onDisconnect.addListener(() => {
      const wasOn = viewing.get(port);
      viewing.delete(port);
      const stillWatched = wasOn != null && [...viewing.values()].includes(wasOn);
      if (import.meta.env.DEV) {
        console.log('[Page Modeller] panel closed; was watching tab', wasOn, stillWatched ? '— still watched' : '— dropping model');
      }
      if (wasOn == null || stillWatched) return;
      store.clear(wasOn);
      // Any panel still listening shows an empty table rather than stale rows.
      publish(wasOn, store.get(wasOn));
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
        // The page the model belongs to, recorded when the first element lands.
        if (model.url == null) model.url = sender.tab?.url ?? null;
        model.elements.push({
          ...m.result,
          id: `el-${idSeq++}`,
          name: uniqueName(m.result.suggestedName, usedNames(model)),
          // Not the engine's preferredIndex: that is framework-agnostic, and
          // would hand a Selenium model a Playwright-only locator.
          selectedIndex: chooseCandidate(m.result.candidates, model.frameworkId),
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
      case 'UPDATE_ELEMENT': {
        const model = store.get(m.tabId);
        const el = model.elements.find((e) => e.id === m.id);
        if (!el) return;
        el.name = m.name;
        el.selectedIndex = m.selectedIndex;
        // Absent means "use the generated candidate again", so it must be
        // deleted rather than set to undefined — the model is serialised.
        if (m.override) el.override = m.override;
        else delete el.override;
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
