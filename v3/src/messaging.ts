import type { ElementResult, FrameStep, LocatorCandidate } from './engine/types';
import type { TabModel } from './model';

// Messages panel → content (sent via browser.tabs.sendMessage to the active tab).
//
// Picking is one-shot in both modes (SPEC §4): the content script stops itself
// as soon as an element is chosen. 'add' takes any single element anywhere;
// 'scan' takes a container and is not wired up yet.
export type PickMode = 'add' | 'scan';
export type PanelToContent =
  // `includeHidden` is the modelHiddenElements setting (SPEC §14), passed in
  // rather than read in the page: the panel already has it, and a content
  // script reading storage would need its own access level.
  // `nonce` is shared by every frame in the tab for this picking session, and
  // is how a frame recognises a scan request from its parent as ours. A page
  // cannot read it — content scripts run in an isolated world — and it does not
  // depend on the receiving frame still being armed, which a cascading scan
  // cannot guarantee (SPEC §16).
  | { type: 'START_PICKING'; mode: PickMode; includeHidden: boolean; nonce: string }
  | { type: 'STOP_PICKING' }
  // Overlay ownership. The content script runs in every frame and each draws
  // its own overlay; without a single owner, hovering down through nested
  // frames leaves a highlight and a breadcrumb in every frame on the way.
  // Pointer events cannot decide it — a parent frame gets no mouseout when the
  // pointer crosses into a child — so a frame announces that it has drawn and
  // the background tells the others to clear.
  | { type: 'OVERLAY_SHOWN'; token: string }
  | { type: 'OVERLAY_OWNER'; token: string }
  // Walk the pick target up or down the DOM (SPEC §4). Sent by the panel
  // because focus is there after clicking Add Element, so the page never sees
  // the keydown — the same reason the panel also handles Escape.
  | { type: 'MOVE_TARGET'; direction: 'up' | 'down' }
  // Commit the current target — Enter, for when the arrows are being used.
  | { type: 'PICK_TARGET' }
  // View Matched Elements (SPEC §8). Answered by HIGHLIGHT_RESULT, not by a
  // reply — see the note on ContentToPanel below.
  // framePath says WHICH document to resolve in: every frame hears this, and
  // the one whose own path matches is the one that answers (SPEC §16).
  | { type: 'HIGHLIGHT'; candidate: LocatorCandidate; framePath?: FrameStep[] }
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
  // A scan's haul, in one message rather than N: the background adds them in a
  // single model update, so the table does not animate in row by row.
  | { type: 'ELEMENTS_PICKED'; results: ElementResult[] }
  | { type: 'PICKING_STOPPED' }
  // `hidden` is how many of those matches have no box of their own, so the
  // count can say why nothing was outlined where you expected it.
  | { type: 'HIGHLIGHT_RESULT'; count: number; hidden: number };

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
  | { type: 'UPDATE_ELEMENT'; tabId: number; id: string; name: string; selectedIndex: number; override?: LocatorCandidate }
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
