// ── Locator Intermediate Representation (IR) ────────────────────────────────
// The framework-agnostic contract between the in-page locator engine and the
// per-framework code generators. Generators consume `candidates` and each emits
// the best locator it can express.
export type LocatorCandidate =
  | { kind: 'testId'; value: string }
  | { kind: 'role'; role: string; name?: string; exact?: boolean }
  | { kind: 'label'; text: string; exact?: boolean }
  | { kind: 'placeholder'; text: string }
  | { kind: 'text'; text: string; exact?: boolean }
  | { kind: 'altText'; text: string }
  | { kind: 'title'; text: string }
  | { kind: 'css'; value: string }
  | { kind: 'xpath'; value: string };

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
  candidates: RankedCandidate[];
  /** Index of the first predicted-unique candidate, or -1 if none. */
  preferredIndex: number;
}

/** A step in a frame path (Phase 1: main-frame only, so paths are empty). */
export interface FrameStep {
  frame: LocatorCandidate;
}

/** A picked element as held in the side-panel session model. */
export interface ElementModel extends ElementResult {
  id: string;
  /** Derived property/method name (see naming.ts). */
  name: string;
  /** Index into `candidates` the user has chosen (defaults to preferredIndex). */
  selectedIndex: number;
  framePath: FrameStep[];
}
