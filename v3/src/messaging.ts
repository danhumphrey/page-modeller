import type { ElementResult } from './engine/types';

// Messages panel → content (sent via browser.tabs.sendMessage to the active tab).
//
// Picking is one-shot in both modes (SPEC §4): the content script stops itself
// as soon as an element is chosen. 'add' takes any single element anywhere;
// 'scan' takes a container and is not wired up yet.
export type PickMode = 'add' | 'scan';
export type PanelToContent = { type: 'START_PICKING'; mode: PickMode } | { type: 'STOP_PICKING' };

// Messages content → panel/background (sent via browser.runtime.sendMessage).
export type ContentToPanel =
  | { type: 'ELEMENT_PICKED'; result: ElementResult }
  | { type: 'PICKING_STOPPED' };

export type Message = PanelToContent | ContentToPanel;

export function isMessage(x: unknown): x is Message {
  return typeof x === 'object' && x !== null && typeof (x as { type?: unknown }).type === 'string';
}
