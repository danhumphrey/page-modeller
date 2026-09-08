// How an element reads in the inspector overlay.
//
// A preview of the locator you are about to get, not just a tag name. Role
// first, because it drives both the locator and the generated methods
// (SPEC §11), then the accessible name, which is what `getByRole` matches on.
//
// The tag appears only when it differs from the role — the case this was
// written for: a plain wrapper <div> and the `<div role="button">` inside it
// have the same bounding box, and both used to read just "div", so there was no
// way to tell which one a click would pick.
import { safeName, safeRole } from './candidates';

const MAX_NAME = 30;

export function describeElement(el: Element): string {
  const raw = safeRole(el);
  // `none` and `presentation` remove an element from the accessibility tree,
  // so they describe nothing — treat them as no role at all.
  const role = raw && raw !== 'none' && raw !== 'presentation' ? raw : '';
  const tag = el.localName;

  let label = role || tag;
  if (role && role !== tag) label += ` (${tag})`;

  const name = safeName(el);
  if (name) label += ` "${name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name}"`;
  return label;
}
