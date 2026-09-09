// ── Locator Intermediate Representation (IR) ────────────────────────────────
// The framework-agnostic contract between the in-page locator engine and the
// per-framework code generators. Generators consume `candidates` and each emits
// the best locator it can express.
export type LocatorCandidate =
  | { kind: 'testId'; value: string }
  | { kind: 'role'; role: string; name?: string; exact?: boolean }
  | { kind: 'label'; text: string; exact?: boolean }
  | { kind: 'placeholder'; text: string; exact?: boolean }
  | { kind: 'text'; text: string; exact?: boolean }
  | { kind: 'altText'; text: string; exact?: boolean }
  | { kind: 'title'; text: string; exact?: boolean }
  | { kind: 'css'; value: string }
  | { kind: 'xpath'; value: string }
  // Selenium's native By strategies. The engine does not generate these yet —
  // that is the superset generator (REWRITE-PLAN §12) — but the IR has to hold
  // them, because the Edit dialog offers the full framework list (SPEC §7) and
  // a hand-typed Selenium locator must be storable and testable with the eye.
  | { kind: 'id'; value: string }
  | { kind: 'name'; value: string }
  | { kind: 'className'; value: string }
  | { kind: 'tagName'; value: string }
  | { kind: 'linkText'; text: string }
  | { kind: 'partialLinkText'; text: string };

export interface RankedCandidate {
  candidate: LocatorCandidate;
  /** How many elements OUR in-page heuristic matches. 1 === predicted-unique. */
  predictedCount: number;
}

/** Raw output of the engine for a single element (no identity/naming yet). */
export interface ElementResult {
  tag: string;
  role: string | null;
  accessibleName: string | null;
  /** Name derived in the page, before de-duplication (see naming.ts). */
  suggestedName: string;
  /**
   * `input`'s type, when it is one. Needed because several input types have no
   * ARIA role at all — `password` most notably — so role alone would classify
   * a field you type into as static (SPEC §11).
   */
  inputType?: string;
  candidates: RankedCandidate[];
  /** Index of the first predicted-unique candidate, or -1 if none. */
  preferredIndex: number;
  /** Outermost first; empty for an element in the main frame (SPEC §16). */
  framePath: FrameStep[];
}

/**
 * One `<iframe>`/`<frame>` between the main document and the element, located
 * the same way any other element is — the parent document is just a document.
 */
export interface FrameStep {
  frame: LocatorCandidate;
  /**
   * True when the chain could not be completed because a document in it is
   * cross-origin, so `window.frameElement` is unreadable from inside. The
   * locator is then relative to that frame rather than to the page, and saying
   * so beats emitting a path that silently starts halfway down.
   */
  opaque?: boolean;
}
