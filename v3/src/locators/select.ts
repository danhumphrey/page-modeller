// Choosing which generated locator an element uses (SPEC §7).
//
// The engine generates a superset — every strategy it can find, Playwright's and
// Selenium's alike — because the model holds one set of candidates and the
// framework decides which are expressible. Without this step a Selenium model
// happily selected `getByRole`, displayed it as `role: heading — Google`, and
// the eye certified it, because our resolver understands roles even though
// Selenium never will.
import { frameworkById } from '../frameworks';
import type { RankedCandidate } from '../engine/types';

/**
 * The candidate a new element should start on: the first one, in the
 * framework's own order of preference, that the framework can express AND that
 * resolves uniquely. Falls back to any expressible candidate, then to the
 * first — `css` and `xpath` are always generated and every framework has them,
 * so the fallbacks are belt and braces.
 */
export function chooseCandidate(candidates: RankedCandidate[], frameworkId: string): number {
  const allowed = frameworkById(frameworkId).locatorTypes;

  for (const type of allowed) {
    const index = candidates.findIndex((c) => c.candidate.kind === type && c.predictedCount === 1);
    if (index >= 0) return index;
  }

  const expressible = candidates.findIndex((c) => allowed.includes(c.candidate.kind));
  return expressible >= 0 ? expressible : 0;
}
