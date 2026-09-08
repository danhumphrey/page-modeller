// The session model (SPEC §5, §7).
//
// One model per TAB, owned by the background. Panels are views: they render
// what the background broadcasts and mutate it by sending messages. Holding it
// in a panel made it one model per *panel*, so a sidebar and a DevTools panel
// on the same tab showed different rows and a pick landed in whichever happened
// to be listening.
//
// Nothing is persisted. A model lives as long as its tab.
import { browser } from 'wxt/browser';
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
  /** The URL the model was built against. Set when the first element lands. */
  url: string | null;
  /**
   * The tab has navigated away from `url`. The background decides this: a
   * DevTools panel cannot read the tab's URL for itself (SPEC §5).
   */
  stale: boolean;
}

export function emptyModel(frameworkId: string): TabModel {
  return { elements: [], frameworkId, url: null, stale: false };
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

/**
 * Per-tab store, backed by `chrome.storage.session`.
 *
 * NOT a plain Map in the background's memory, which is where this started. An
 * MV3 service worker is terminated after 30 seconds of inactivity, and since
 * Chrome 114 an open port does not reset that timer — so every model silently
 * vanished after half a minute of not clicking, and came back only because
 * restarting the browser gave you a fresh worker.
 *
 * `storage.session` is the right store rather than `storage.local`: it lives in
 * memory, is cleared when the browser closes, and is never written to disk, so
 * SPEC §5 still holds — a model is session work, not a saved artifact. It just
 * outlives the worker now.
 *
 * Writes are serialised through one chain: every change is a read-modify-write
 * of the whole map, and two overlapping ones would lose an update.
 */
const KEY = 'models';

type Models = Record<string, TabModel>;

export class ModelStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private defaultFrameworkId: string) {}

  private async read(): Promise<Models> {
    const stored = (await browser.storage.session.get(KEY)) as { models?: Models };
    return stored.models ?? {};
  }

  /** Run `change` against the stored map, serialised, and return the result. */
  private update<T>(change: (models: Models) => T): Promise<T> {
    const next = this.queue.then(async () => {
      const models = await this.read();
      const result = change(models);
      await browser.storage.session.set({ [KEY]: models });
      return result;
    });
    // Keep the chain going even if one change throws.
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** The model for a tab, created empty if this is the first time. */
  get(tabId: number): Promise<TabModel> {
    return this.update((models) => (models[tabId] ??= emptyModel(this.defaultFrameworkId)));
  }

  /** Read, change, and store in one serialised step. */
  mutate(tabId: number, change: (model: TabModel) => void): Promise<TabModel> {
    return this.update((models) => {
      const model = (models[tabId] ??= emptyModel(this.defaultFrameworkId));
      change(model);
      return model;
    });
  }

  clear(tabId: number): Promise<void> {
    return this.update((models) => {
      delete models[tabId];
    });
  }
}
