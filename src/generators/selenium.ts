// The one place that decides which Selenium `By` strategy a candidate is.
//
// Shared by all three languages: they disagree about spelling — `By.id`,
// `By.Id`, `By.ID` — never about which strategy applies.
import type { LocatorCandidate } from '../engine/types';

export type ByKind = 'id' | 'name' | 'className' | 'tagName' | 'linkText' | 'partialLinkText' | 'css' | 'xpath';

/** `null` for a Playwright-only kind, which selection never picks (SPEC §7). */
export function byParts(c: LocatorCandidate): { kind: ByKind; value: string } | null {
  switch (c.kind) {
    case 'id':
    case 'name':
    case 'className':
    case 'tagName':
    case 'css':
    case 'xpath':
      return { kind: c.kind, value: c.value };
    case 'linkText':
    case 'partialLinkText':
      return { kind: c.kind, value: c.text };
    default:
      return null;
  }
}
