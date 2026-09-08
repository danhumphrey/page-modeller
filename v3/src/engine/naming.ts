// Derive a readable, unique name for a picked element (SPEC §13).
//
// Ported from v2.5.1's ordered rule list — first rule to yield a usable name
// wins — with the four agreed changes:
//
//   1. camelCase runs BEFORE whitespace is stripped. v2.5.1 stripped first,
//      destroying word boundaries, which is why it produced TableofContents
//      and DocumentUploadandQuery.
//   2. The computed accessible name replaces the hand-rolled label /
//      aria-label / textContent rules, which were a partial reimplementation
//      of accname.
//   3. The accessible name outranks the `name` and `id` attributes. v2.5.1
//      named a button with id="btn-1" and the text "Submit" `Btn1`.
//   4. The ng-model and ng-binding rules are gone.
//
// Names stay plain — `About`, not `AboutLink`. No role suffix.
import { computeAccessibleName } from 'dom-accessibility-api';

const MAX_NAME_LENGTH = 25;

/** Input types that describe themselves when nothing else names them. */
const SELF_DESCRIBING = new Set(['password', 'email', 'tel', 'url', 'search', 'color', 'date', 'month', 'week', 'time']);

function attr(el: Element, name: string): string {
  return (el.getAttribute(name) ?? '').trim();
}

function accessibleName(el: Element): string {
  try {
    return computeAccessibleName(el).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

/**
 * Build-generated identifiers make terrible names: they are meaningless to read
 * and they change on the next build of the site under test. `Xtvsq51` is not a
 * name anyone would choose.
 *
 * Two signals, both deliberately conservative — a false positive only falls
 * through to the next naming rule, while a false negative ships a name that
 * will rot.
 */
export function looksGenerated(value: string): boolean {
  // Known CSS-in-JS shapes: emotion (css-1q2w3e), styled-components (sc-bdVaJa),
  // CSS Modules (Button_root__2xK9f), and leading-underscore hashes (_2xK9f).
  if (/^(css|sc|emotion)-[a-z0-9]+$/i.test(value)) return true;
  if (/__[A-Za-z0-9]{4,}$/.test(value)) return true;
  if (/^_+[A-Za-z0-9]{4,}$/.test(value)) return true;
  // React's useId: ":r1:" and "«r1»" from React 18, "_r_6_" from React 19.
  if (/^[:«][a-z0-9]+[:»]$/i.test(value)) return true;
  if (/^_r_[a-z0-9]+_$/i.test(value)) return true;
  // No pronounceable structure: a run of 4+ letters without a vowel. Real
  // words and abbreviations ("btn", "nav", "col") stay under that bar.
  return /[^aeiouy\W\d]{4,}/i.test(value);
}

function uniqueClassName(el: Element): string {
  for (const cls of Array.from(el.classList)) {
    if (looksGenerated(cls)) continue;
    if (el.ownerDocument.getElementsByClassName(cls).length === 1) return cls;
  }
  return '';
}

function tagIndexName(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const all = el.ownerDocument.getElementsByTagName(el.tagName);
  const index = Array.prototype.indexOf.call(all, el) + 1;
  return `${tag}${index}`;
}

/**
 * Visible text, for elements the accessible name cannot describe.
 *
 * accname only derives a name from content for roles that support it, so a
 * plain <span> or <div> — exactly what Add Element is for (SPEC §4) — computes
 * to nothing and would fall through to `Span97`. Capped, because a container's
 * textContent can be most of the page, and truncating that produces a name as
 * useless as the tag index it replaced.
 */
const MAX_TEXT_SOURCE = 80;

function textContent(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 0 && text.length <= MAX_TEXT_SOURCE ? text : '';
}

/** Ordered; the first to return a non-empty string wins. */
const rules: Array<(el: Element) => string> = [
  accessibleName,
  textContent,
  (el) => attr(el, 'placeholder'),
  (el) => (el.tagName === 'BUTTON' || ['submit', 'reset'].includes((el as HTMLInputElement).type) ? attr(el, 'value') : ''),
  (el) => attr(el, 'name'),
  (el) => (looksGenerated(attr(el, 'id')) ? '' : attr(el, 'id')),
  uniqueClassName,
  (el) => (el.tagName === 'INPUT' && SELF_DESCRIBING.has((el as HTMLInputElement).type) ? `${(el as HTMLInputElement).type}Element` : ''),
  tagIndexName,
];

const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/**
 * `Table of Contents` → `TableOfContents`. Word boundaries come from
 * whitespace, punctuation and existing camelCase, so they must be read before
 * anything is stripped.
 */
function toPascalCase(raw: string): string {
  const words = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

/** Truncate at a word boundary rather than mid-word (SPEC §13). */
function truncate(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  const boundaries = [...name.matchAll(/[A-Z][^A-Z]*/g)];
  let out = '';
  for (const m of boundaries) {
    if (out.length + m[0].length > MAX_NAME_LENGTH) break;
    out += m[0];
  }
  // A single word longer than the limit has no boundary to cut on.
  return out || name.slice(0, MAX_NAME_LENGTH);
}

function clean(raw: string): string {
  // Defensive: accname already normalises whitespace, so this only bites on a
  // raw attribute (placeholder, name, id) that contains a newline.
  const firstLine = raw.split(/\r\n|\r|\n/)[0];
  let name = toPascalCase(firstLine);
  if (!name) return '';
  // Identifiers cannot start with a digit.
  if (/^\d/.test(name)) {
    name = name.length === 1 ? DIGIT_WORDS[Number(name)] : `Element${name}`;
    name = name[0].toUpperCase() + name.slice(1);
  }
  return truncate(name);
}

/**
 * The name this element suggests for itself. Runs in the page, since every rule
 * after the accessible name reads the DOM.
 */
export function baseName(el: Element): string {
  for (const rule of rules) {
    const name = clean(rule(el));
    if (name) return name;
  }
  return 'Element';
}

/**
 * Make `base` unique within `used`, which is mutated to reserve the result.
 * Runs in the panel, which owns the model — a second `About` becomes `About2`.
 */
export function uniqueName(base: string, used: Set<string>): string {
  let name = base || 'Element';
  let n = 2;
  while (used.has(name)) name = `${base}${n++}`;
  used.add(name);
  return name;
}
