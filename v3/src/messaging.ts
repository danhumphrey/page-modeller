import type { ElementResult, LocatorCandidate } from './engine/types';
import type { TabModel } from './model';

// Messages panel → content (sent via browser.tabs.sendMessage to the active tab).
//
// Picking is one-shot in both modes (SPEC §4): the content script stops itself
// as soon as an element is chosen. 'add' takes any single element anywhere;
// 'scan' takes a container and is not wired up yet.
export type PickMode = 'add' | 'scan';
export type PanelToContent =
  | { type: 'START_PICKING'; mode: PickMode }
  | { type: 'STOP_PICKING' }
  // View Matched Elements (SPEC §8). Answered by HIGHLIGHT_RESULT, not by a
  // reply — see the note on ContentToPanel below.
  | { type: 'HIGHLIGHT'; candidate: LocatorCandidate }
  // Clear the highlight early — the user dismissed the match count.
  | { type: 'CLEAR_HIGHLIGHT' };

// Messages content → panel/background (sent via browser.runtime.sendMessage).
//
// Everything the content script has to say travels this way, including answers
// to panel requests. Request/response via sendResponse is not portable: Chrome
// wants `return true` for an async reply, Firefox's native browser.* wants a
// returned Promise, and doing both leaves the caller's promise unsettled on
// Firefox — which surfaced as "can't reach this page" for a tab that was
// plainly reachable.
export type ContentToPanel =
  | { type: 'ELEMENT_PICKED'; result: ElementResult }
  | { type: 'PICKING_STOPPED' }
  | { type: 'HIGHLIGHT_RESULT'; count: number };

// Messages panel → background.
//
// The panel never calls tabs.sendMessage itself. A DevTools page gets only a
// subset of the extension APIs — devtools.*, runtime.*, and little else — and
// `tabs` is not in it, which is documented for both browsers. Chrome happens to
// tolerate the direct call from a panel page; Firefox does not, so the DevTools
// panel could not reach the page at all. Relaying through the background is the
// documented route, and using it everywhere keeps one code path instead of a
// per-surface branch.
/**
 * Port name every panel connects on. The background counts these to know when
 * the last panel has closed and the session is over (SPEC §5).
 */
export const PANEL_PORT = 'page-modeller-panel';

/**
 * Sent over the port whenever a panel changes which tab it is showing. The
 * background needs it to decide, when a panel closes, whether any panel is
 * still watching the tab it was on.
 */
export interface PanelViewing {
  tabId: number | undefined;
}

export type PanelToBackground =
  | { type: 'RELAY_TO_TAB'; tabId: number; message: PanelToContent }
  // Model commands. The background owns the model (SPEC §5), so panels ask for
  // changes rather than making them, and every panel on the tab sees the result.
  | { type: 'GET_MODEL'; tabId: number }
  | { type: 'DELETE_ELEMENT'; tabId: number; id: string }
  | { type: 'DELETE_MODEL'; tabId: number }
  | { type: 'SET_FRAMEWORK'; tabId: number; frameworkId: string };

// Messages background → panel.
//
// Content traffic is re-broadcast from the background with the tab stamped on
// it. The panel cannot do that filtering itself: Firefox does not reliably
// populate `sender.tab` for a message delivered to a DevTools page, so a
// `sender.tab.id === myTab` check drops every pick without a trace. The
// background always sees the sender, so it is the one context that can say
// which tab a message came from.
export type BackgroundToPanel =
  | { type: 'TAB_UNREACHABLE'; tabId: number }
  | { type: 'FROM_TAB'; tabId: number; message: ContentToPanel }
  // The whole model, after every change. Small enough that diffing would cost
  // more in complexity than it saves, and it keeps panels stateless.
  | { type: 'MODEL'; tabId: number; model: TabModel };

export type Message = PanelToContent | ContentToPanel | PanelToBackground | BackgroundToPanel;

export function isMessage(x: unknown): x is Message {
  return typeof x === 'object' && x !== null && typeof (x as { type?: unknown }).type === 'string';
}
