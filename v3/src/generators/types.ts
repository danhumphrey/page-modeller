import type { LocatorCandidate } from '../engine/types';

export interface PomElement {
  name: string;
  candidate: LocatorCandidate;
  /** Optional ARIA role, used only for a generated comment. */
  role?: string | null;
}

export interface PomModel {
  className: string;
  url?: string;
  elements: PomElement[];
}

export type TargetFramework = 'playwright-ts';

export interface Generator {
  id: TargetFramework;
  label: string;
  /** File extension for the generated artifact, e.g. 'ts'. */
  ext: string;
  generate(model: PomModel): string;
}
