import { computeAccessibleName, getRole } from 'dom-accessibility-api';
import type { LocatorCandidate, ElementResult, RankedCandidate } from './types';
import { baseName } from './naming';

const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

// Elements Playwright's getByLabel actually matches: form controls named via an
// associated <label>/aria-label. NOT buttons — a button named by its text content
// is found via getByRole/getByText, and getByLabel returns 0 for it.
const LABEL_TARGETS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
// Controls with no meaningful textContent — excluded from getByText candidates.
const NON_TEXT = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

// CSS ::before/::after generated text participates in the accessible name per the
// accname spec, but dom-accessibility-api does not read pseudo-element content.
// Playwright does — so fold it in for content-derived names to match Playwright.
function pseudoText(el: Element, pseudo: '::before' | '::after'): string {
  try {
    const c = getComputedStyle(el, pseudo).content;
    if (!c || c === 'none' || c === 'normal') return '';
    const m = c.match(/^"([\s\S]*)"$/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

function safeName(el: Element): string {
  try {
    let name = norm(computeAccessibleName(el));
    // Pseudo content only contributes when the name is derived from content
    // (not when an explicit aria-label/aria-labelledby supplies it).
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
      const before = pseudoText(el, '::before');
      const after = pseudoText(el, '::after');
      if (before || after) name = norm(`${before} ${name} ${after}`);
    }
    return name;
  } catch {
    return '';
  }
}

function safeRole(el: Element): string | null {
  try {
    return getRole(el) || null;
  } catch {
    return null;
  }
}

// ---- selector builders (deterministic fallbacks) ----

function cssFor(el: Element): string {
  if (el.id) {
    const byId = `#${CSS.escape(el.id)}`;
    if (el.ownerDocument.querySelectorAll(byId).length === 1) return byId;
  }
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur !== cur.ownerDocument.documentElement) {
    if (cur.id) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    let sel = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
    }
    parts.unshift(sel);
    cur = parent;
  }
  return parts.join(' > ');
}

function xpathFor(el: Element): string {
  if (el.id) return `//*[@id=${JSON.stringify(el.id)}]`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1) {
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    let idx = 1;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (same.length > 1) idx = same.indexOf(cur) + 1;
    }
    parts.unshift(`${tag}[${idx}]`);
    cur = parent;
  }
  return '/' + parts.join('/');
}

// ---- resolution ----
//
// One implementation, two callers: predicted uniqueness while ranking
// candidates, and View Matched Elements (SPEC §8), which needs the elements
// themselves so it can highlight them. They must agree, or the count the engine
// ranked on would differ from the count the eye reports.

/**
 * Playwright's text matching, which the eye must reproduce or its count will
 * disagree with the test that later runs the locator.
 *
 *   exact: true   case-sensitive, whole-string
 *   exact: false  case-insensitive, substring   (Playwright's default)
 *
 * Whitespace is normalised either way — "exact match still trims whitespace",
 * and matching by text collapses runs and turns line breaks into spaces.
 */
export function matchesText(actual: string, expected: string, exact: boolean | undefined): boolean {
  const a = norm(actual);
  const b = norm(expected);
  return exact ? a === b : a.toLowerCase().includes(b.toLowerCase());
}

/**
 * Excluded from the accessibility tree, per ARIA tree exclusion. `getByRole`
 * applies this by default (`includeHidden: false`) and we must too, or the eye
 * counts hidden elements the test will never see.
 */
function ariaHidden(el: Element): boolean {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    if (cur.getAttribute('aria-hidden') === 'true') return true;
    if ((cur as HTMLElement).hidden) return true;
    try {
      const st = cur.ownerDocument.defaultView?.getComputedStyle(cur);
      if (st && (st.display === 'none' || st.visibility === 'hidden' || st.visibility === 'collapse')) return true;
    } catch {
      /* detached or cross-document; treat as visible */
    }
  }
  return false;
}

/** Every element the candidate matches, in document order. */
export function resolveCandidate(doc: Document, c: LocatorCandidate): Element[] {
  const all = () => Array.from(doc.querySelectorAll('*'));
  switch (c.kind) {
    case 'testId':
      return Array.from(doc.querySelectorAll(`[data-testid="${CSS.escape(c.value)}"]`));
    case 'role':
      return all()
        .filter((e) => safeRole(e) === c.role && (c.name === undefined || matchesText(safeName(e), c.name, c.exact)))
        .filter((e) => !ariaHidden(e));
    case 'label':
      return all().filter((e) => LABEL_TARGETS.has(e.tagName) && matchesText(safeName(e), c.text, c.exact));
    case 'placeholder':
      return Array.from(doc.querySelectorAll('[placeholder]')).filter((e) =>
        matchesText(e.getAttribute('placeholder') ?? '', c.text, c.exact)
      );
    case 'text': {
      // Playwright matches the *smallest* element containing the text, so an
      // ancestor whose text comes entirely from a matching descendant does not
      // count. Without this a <fieldset> matches alongside its <legend>.
      const hits = all().filter((e) => matchesText((e as HTMLElement).textContent ?? '', c.text, c.exact));
      return hits.filter((e) => !hits.some((other) => other !== e && e.contains(other)));
    }
    case 'altText':
      return Array.from(doc.querySelectorAll('img[alt], input[alt], area[alt]')).filter((e) =>
        matchesText(e.getAttribute('alt') ?? '', c.text, c.exact)
      );
    case 'title':
      return Array.from(doc.querySelectorAll('[title]')).filter((e) => matchesText(e.getAttribute('title') ?? '', c.text, c.exact));
    case 'css':
      // A hand-typed selector can be invalid; that is a miss, not a crash.
      try {
        return Array.from(doc.querySelectorAll(c.value));
      } catch {
        return [];
      }
    case 'xpath': {
      try {
        const r = doc.evaluate(c.value, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return Array.from({ length: r.snapshotLength }, (_, i) => r.snapshotItem(i) as Element);
      } catch {
        return [];
      }
    }
  }
}

function predictedCount(doc: Document, c: LocatorCandidate): number {
  return resolveCandidate(doc, c).length;
}

// ---- candidate generation (ranked, mirrors Playwright's priority) ----

export function generate(el: Element): ElementResult {
  const doc = el.ownerDocument;
  const role = safeRole(el);
  const name = safeName(el);
  const tag = el.tagName.toLowerCase();
  const out: LocatorCandidate[] = [];

  const testId = el.getAttribute('data-testid');
  if (testId) out.push({ kind: 'testId', value: testId });

  if (role) {
    if (name) out.push({ kind: 'role', role, name, exact: true });
    else out.push({ kind: 'role', role });
  }

  // getByLabel only matches a real <label> association or an aria-label — NOT names
  // sourced from title / submit value / aria-labelledby (those still get getByRole).
  const hasLabelAssoc = ((el as HTMLInputElement).labels?.length ?? 0) > 0;
  const hasAriaLabel = el.hasAttribute('aria-label');
  if (LABEL_TARGETS.has(el.tagName) && name && (hasLabelAssoc || hasAriaLabel)) {
    out.push({ kind: 'label', text: name, exact: true });
  }

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) out.push({ kind: 'placeholder', text: norm(placeholder), exact: true });

  if (tag === 'img') {
    const alt = el.getAttribute('alt');
    if (alt) out.push({ kind: 'altText', text: norm(alt), exact: true });
  }

  const title = el.getAttribute('title');
  if (title) out.push({ kind: 'title', text: norm(title), exact: true });

  if (!NON_TEXT.has(el.tagName)) {
    const text = norm(el.textContent);
    if (text && text.length <= 80) out.push({ kind: 'text', text, exact: true });
  }

  out.push({ kind: 'css', value: cssFor(el) });
  out.push({ kind: 'xpath', value: xpathFor(el) });

  const candidates: RankedCandidate[] = out.map((candidate) => ({
    candidate,
    predictedCount: predictedCount(doc, candidate),
  }));

  const preferredIndex = candidates.findIndex((c) => c.predictedCount === 1);

  return { tag, role, accessibleName: name || null, suggestedName: baseName(el), candidates, preferredIndex };
}
