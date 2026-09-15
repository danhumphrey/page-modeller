import type { ElementResult, ShadowStep } from '../src/engine/types';

/**
 * The engine, as injected into a page under test by `bundle-engine`.
 *
 * Declared once, here, because two specs used to declare `window.__spike`
 * independently and the narrower declaration won — so the shadow spec's calls
 * were type errors against a shape that did not include them, on a global that
 * plainly had them at runtime.
 */
export interface Spike {
  generate(el: Element): ElementResult;
  resolveCandidate(root: Document | ShadowRoot, c: unknown): Element[];
  shadowPathOf(el: Element): ShadowStep[];
  shadowSelector(step: ShadowStep): string;
  collectInteractive(root: Element, includeHidden: boolean): Element[];
  collectClosedHosts(root: Element): Element[];
  /** The name an element suggests for itself, before the panel makes it unique. */
  baseName(el: Element): string;
  /** Run a scan's worth of work against one memo (SPEC §4). */
  batched<T>(run: () => T): T;
}

declare global {
  interface Window {
    __spike: Spike;
  }
}
