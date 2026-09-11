import { browser } from 'wxt/browser';
import { isMessage, PANEL_PORT, type Message, type PanelViewing } from '@/src/messaging';
import { ModelStore, usedNames, type TabModel } from '@/src/model';
import { uniqueName } from '@/src/engine/naming';
import { defaultFrameworkId } from '@/src/frameworks';
import { chooseCandidate } from '@/src/locators/select';
import { withTypeSuffix } from '@/src/locators/type-name';
import { loadSettings } from '@/src/settings';

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
/** Where Support goes — the repository, as in v2.5.1. */
const SUPPORT_URL = 'https://github.com/danhumphrey/page-modeller';

export default defineBackground(() => {
  console.log('[Page Modeller] background ready', import.meta.env.MODE, import.meta.env.BROWSER);

  const store = new ModelStore(defaultFrameworkId);

  /**
   * Disarm the picker in every frame of a tab. `tabs.sendMessage` with no
   * `frameId` reaches all of them, and a frame that is already stopped ignores
   * it.
   */
  function stopEveryFrame(tabId: number) {
    browser.tabs.sendMessage(tabId, { type: 'STOP_PICKING' }).catch(() => {});
  }

  /** Every panel gets the model; each ignores tabs that are not its own. */
  function publish(tabId: number, model: TabModel) {
    browser.runtime.sendMessage({ type: 'MODEL', tabId, model }).catch(() => {});
  }

  /** Apply a change and tell every panel. The store is async now: it lives in
   *  storage.session, because the worker itself does not survive 30s idle. */
  async function change(tabId: number, mutate: (model: TabModel) => void) {
    publish(tabId, await store.mutate(tabId, mutate));
  }

  browser.tabs.onRemoved.addListener((tabId) => store.clear(tabId));

  // A model kept across a navigation may no longer describe the page (SPEC §5).
  // The background has to notice: a DevTools panel cannot read the tab's URL.
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    const url = changeInfo.url;
    void store
      .mutate(tabId, (model) => {
        if (model.url == null) return;
        // Navigating back to where it was built makes it current again.
        model.stale = model.url !== url;
      })
      .then((model) => publish(tabId, model));
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
      // Disarm the page as well as dropping the model. Picking lives in the
      // content script, which has no idea a panel ever closed: left armed, it
      // goes on drawing the overlay over every element the pointer crosses and
      // swallowing the next click, and there is no longer anything listening
      // for what it picks. Closing the panel is the end of the session (SPEC
      // §5), so it is the end of picking too.
      //
      // Only once no panel is left on the tab — the guard above — because two
      // panels can watch one tab, and the one still open can still receive a
      // pick.
      stopEveryFrame(wasOn);
      void store
        .clear(wasOn)
        .then(() => store.get(wasOn))
        // Any panel still listening shows an empty table rather than stale rows.
        .then((model) => publish(wasOn, model));
    });
  });

  browser.runtime.onMessage.addListener((msg: unknown, sender: { tab?: { id?: number } }) => {
    if (!isMessage(msg)) return;
    const m = msg as Message;

    switch (m.type) {
      // ---- from a content script ----
      case 'ELEMENT_PICKED':
      case 'ELEMENTS_PICKED': {
        const tabId = sender.tab?.id;
        if (tabId == null) return;
        const url = sender.tab?.url ?? null;
        // One path for a single pick and a scan's haul, so both name and rank
        // identically — a scan is just Add, many times over.
        const results = m.type === 'ELEMENTS_PICKED' ? m.results : [m.result];
        // Read before mutating: the change callback is synchronous, and naming
        // depends on a setting the user can change at any time (SPEC §13).
        void loadSettings().then((settings) =>
          change(tabId, (model) => {
            // The page the model belongs to, recorded when the first element
            // lands.
            if (model.url == null) model.url = url;
            // usedNames is derived from the model, so it is recomputed as each
            // element lands — otherwise a scan of ten "Delete" buttons would
            // name them all the same.
            for (const result of results) {
              model.elements.push({
                ...result,
                // Unique within the model rather than a worker-lifetime
                // counter: the worker restarts, and so would the counter.
                id: `el-${Date.now().toString(36)}-${model.elements.length}`,
                name: uniqueName(
                  settings.appendTypeToName ? withTypeSuffix(result.suggestedName, result.role) : result.suggestedName,
                  usedNames(model)
                ),
                // Not the engine's preferredIndex: that is framework-agnostic,
                // and would hand a Selenium model a Playwright-only locator.
                selectedIndex: chooseCandidate(result.candidates, model.frameworkId),
              });
            }
          })
        );
        // Held the modifier: Add stays armed, so neither the frames nor the
        // toolbar should be told it is over (SPEC §4).
        if (m.type === 'ELEMENT_PICKED' && m.keepPicking) return;

        // Picking is one-shot (SPEC §4) per TAB, not per frame. START_PICKING
        // is broadcast to every frame and each arms itself, but only the frame
        // that was clicked stops itself — the rest stayed live and recorded the
        // next click too, so one pick in a framed page added three elements.
        stopEveryFrame(tabId);
        // And tell the panels, so they can un-arm the toolbar.
        browser.runtime.sendMessage({ type: 'FROM_TAB', tabId, message: { type: 'PICKING_STOPPED' } }).catch(() => {});
        return;
      }
      case 'OVERLAY_SHOWN': {
        const tabId = sender.tab?.id;
        if (tabId == null) return;
        // Every frame hears it; each clears unless the token is its own.
        browser.tabs.sendMessage(tabId, { type: 'OVERLAY_OWNER', token: m.token }).catch(() => {});
        return;
      }
      case 'PICKING_STOPPED': {
        const tabId = sender.tab?.id;
        if (tabId == null) return;
        // Escape reaches only the frame with focus; the others are still armed.
        stopEveryFrame(tabId);
        browser.runtime.sendMessage({ type: 'FROM_TAB', tabId, message: m }).catch(() => {});
        return;
      }
      case 'FRAME_UNREADABLE':
      case 'SHADOW_UNREADABLE':
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
        void store.get(m.tabId).then((model) => publish(m.tabId, model));
        return;
      case 'DELETE_ELEMENT':
        void change(m.tabId, (model) => {
          model.elements = model.elements.filter((e) => e.id !== m.id);
        });
        return;
      case 'UPDATE_ELEMENT':
        void change(m.tabId, (model) => {
          const el = model.elements.find((e) => e.id === m.id);
          if (!el) return;
          el.name = m.name;
          el.selectedIndex = m.selectedIndex;
          // Absent means "use the generated candidate again", so it must be
          // deleted rather than set to undefined — the model is serialised.
          if (m.override) el.override = m.override;
          else delete el.override;
        });
        return;
      case 'DELETE_MODEL':
        void store
          .clear(m.tabId)
          .then(() => store.get(m.tabId))
          .then((model) => publish(m.tabId, model));
        return;
      case 'SET_FRAMEWORK':
        void change(m.tabId, (model) => {
          model.frameworkId = m.frameworkId;
        });
        return;
    }
  });

  // Right-clicking the toolbar icon (SPEC §15). v2.5.1 carried Support and
  // Options in a popup; the popup is gone, because a click should open the
  // panel rather than a menu, and this is where those links belong instead.
  //
  // Only what the browser does not already offer. Chrome puts Options on this
  // menu itself, so adding our own would show it twice; Firefox offers
  // "Manage Extension", which goes to about:addons rather than the options
  // page, so there it earns its place.
  const items: Array<{ id: string; title: string }> = [{ id: 'support', title: 'Support' }];
  if (import.meta.env.FIREFOX) items.unshift({ id: 'options', title: 'Options' });

  // On every worker start, not on install: onInstalled does not reliably fire
  // when an unpacked extension is reloaded, which is every rebuild in dev, and
  // the menu would then be missing. removeAll first, or re-creating a known id
  // throws.
  browser.contextMenus.removeAll(() => {
    for (const { id, title } of items) {
      browser.contextMenus.create({ id, title, contexts: ['action'] });
    }
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'options') void browser.runtime.openOptionsPage();
    else if (info.menuItemId === 'support') void browser.tabs.create({ url: SUPPORT_URL });
  });

  if (import.meta.env.FIREFOX) {
    // sidebarAction.toggle() needs a user gesture — the action click is one.
    browser.action.onClicked.addListener(() => browser.sidebarAction.toggle());
    return;
  }

  // Chromium: let the action button open the side panel directly. Doing it this
  // way (rather than sidePanel.open) keeps the click a trusted user gesture.
  if (browser.sidePanel) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  } else {
    // No side panel API — Opera. It parses the `side_panel` manifest key and
    // ignores the feature, so there was nothing to set a behaviour on and the
    // button did nothing whatever: no panel, no popup, no error.
    //
    // The panel cannot fall back to a tab of its own, because it finds the
    // page it is modelling with `tabs.query({ active: true, currentWindow:
    // true })` and would target itself. DevTools genuinely is the only surface
    // here, so the click says so — which is what v2.5.1's popup did, back when
    // DevTools was the only surface anywhere (SPEC §15).
    //
    // Set at runtime rather than declared, because one Chromium build serves
    // every Chromium browser and only this one wants a popup: declaring
    // `default_popup` would replace the side panel with a leaflet on Chrome.
    void browser.action.setPopup({ popup: 'nopanel.html' });
  }
});
