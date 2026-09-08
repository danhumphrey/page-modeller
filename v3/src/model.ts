// The session model (SPEC §5, §7).
//
// One model per TAB, owned by the background. Panels are views: they render
// what the background broadcasts and mutate it by sending messages. Holding it
// in a panel made it one model per *panel*, so a sidebar and a DevTools panel
// on the same tab showed different rows and a pick landed in whichever happened
// to be listening.
//
// Nothing is persisted. A model lives as long as its tab.
import type { ElementResult, LocatorCandidate } from './engine/types';

export interface ModelElement extends ElementResult {
  id: string;
  name: string;
  /** Index into `candidates`, or -1 when the user typed a locator by hand. */
  selectedIndex: number;
  /** Set only when the user overrides the generated locator (SPEC §7). */
  override?: LocatorCandidate;
}

/** Serialisable: it crosses the message boundary on every change. */
export interface TabModel {
  elements: ModelElement[];
  /** Chosen up front and locked once the model has anything in it (SPEC §3). */
  frameworkId: string;
  /** The URL the model was built against, for the stale check (SPEC §5). */
  url: string | null;
}

export function emptyModel(frameworkId: string): TabModel {
  return { elements: [], frameworkId, url: null };
}

/** The locator currently in effect for an element: an override, or the pick. */
export function activeCandidate(el: ModelElement): LocatorCandidate {
  return el.override ?? el.candidates[el.selectedIndex]?.candidate ?? el.candidates[0].candidate;
}

/**
 * Names in use, derived rather than tracked. A stored set would have to be kept
 * in step with deletions; deriving it means a freed name is reusable with no
 * bookkeeping.
 */
export function usedNames(model: TabModel): Set<string> {
  return new Set(model.elements.map((e) => e.name));
}

/** Per-tab store. Lives in the background; entries die with their tab. */
export class ModelStore {
  private byTab = new Map<number, TabModel>();

  constructor(private defaultFrameworkId: string) {}

  get(tabId: number): TabModel {
    let m = this.byTab.get(tabId);
    if (!m) {
      m = emptyModel(this.defaultFrameworkId);
      this.byTab.set(tabId, m);
    }
    return m;
  }

  clear(tabId: number): void {
    this.byTab.delete(tabId);
  }

}
