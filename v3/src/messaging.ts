import type { ElementResult } from './engine/types';

// Messages panel → content (sent via browser.tabs.sendMessage to the active tab).
export type PanelToContent = { type: 'START_PICKING' } | { type: 'STOP_PICKING' };

// Messages content → panel/background (sent via browser.runtime.sendMessage).
export type ContentToPanel =
  | { type: 'ELEMENT_PICKED'; result: ElementResult }
  | { type: 'PICKING_STOPPED' };

export type Message = PanelToContent | ContentToPanel;

export function isMessage(x: unknown): x is Message {
  return typeof x === 'object' && x !== null && typeof (x as { type?: unknown }).type === 'string';
}
