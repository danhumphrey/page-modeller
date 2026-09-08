// The session model (SPEC §5, §7).
//
// One model per tab, held in memory. Switching tabs swaps the table; closing
// the tab or the panel discards it. Nothing is persisted — a model is session
// work, not a saved artifact, and this way a model can never be shown against
// a page it was not built from.
import type { ElementResult, LocatorCandidate } from './engine/types';

export interface ModelElement extends ElementResult {
  id: string;
  name: string;
  /** Index into `candidates`, or -1 when the user typed a locator by hand. */
  selectedIndex: number;
  /** Set only when the user overrides the generated locator (SPEC §7). */
  override?: LocatorCandidate;
}

export interface TabModel {
  elements: ModelElement[];
  /** Reserves derived names so a second `About` becomes `About2`. */
  usedNames: Set<string>;
  /** The URL the model was built against, for the stale check (SPEC §5). */
  url: string | null;
}

export function emptyModel(): TabModel {
  return { elements: [], usedNames: new Set(), url: null };
}

/** The locator currently in effect for an element: an override, or the pick. */
export function activeCandidate(el: ModelElement): LocatorCandidate {
  return el.override ?? el.candidates[el.selectedIndex]?.candidate ?? el.candidates[0].candidate;
}

/** Per-tab store. Keyed by tab id; entries live only as long as the panel. */
export class ModelStore {
  private byTab = new Map<number, TabModel>();

  get(tabId: number): TabModel {
    let m = this.byTab.get(tabId);
    if (!m) {
      m = emptyModel();
      this.byTab.set(tabId, m);
    }
    return m;
  }

  clear(tabId: number): void {
    this.byTab.delete(tabId);
  }

  /** Drop models for tabs that have gone away, so closing a tab frees it. */
  retain(liveTabIds: Iterable<number>): void {
    const live = new Set(liveTabIds);
    for (const id of [...this.byTab.keys()]) if (!live.has(id)) this.byTab.delete(id);
  }
}
