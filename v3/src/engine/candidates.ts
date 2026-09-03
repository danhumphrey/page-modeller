import { computeAccessibleName, getRole } from 'dom-accessibility-api';
import type { LocatorCandidate, ElementResult, RankedCandidate } from './types';

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

// ---- predicted uniqueness (OUR best-effort, mirrors Playwright semantics) ----

function predictedCount(doc: Document, c: LocatorCandidate): number {
  const all = () => Array.from(doc.querySelectorAll('*'));
  switch (c.kind) {
    case 'testId':
      return doc.querySelectorAll(`[data-testid="${CSS.escape(c.value)}"]`).length;
    case 'role':
      return all().filter((e) => safeRole(e) === c.role && (c.name === undefined || safeName(e) === c.name)).length;
    case 'label':
      return all().filter((e) => LABEL_TARGETS.has(e.tagName) && safeName(e) === c.text).length;
    case 'placeholder':
      return Array.from(doc.querySelectorAll('[placeholder]')).filter(
        (e) => norm(e.getAttribute('placeholder')) === c.text
      ).length;
    case 'text':
      return all().filter((e) => norm((e as HTMLElement).textContent) === c.text).length;
    case 'altText':
      return Array.from(doc.querySelectorAll('img[alt], input[alt], area[alt]')).filter(
        (e) => norm(e.getAttribute('alt')) === c.text
      ).length;
    case 'title':
      return Array.from(doc.querySelectorAll('[title]')).filter((e) => norm(e.getAttribute('title')) === c.text).length;
    case 'css':
      return doc.querySelectorAll(c.value).length;
    case 'xpath': {
      const r = doc.evaluate(c.value, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      return r.snapshotLength;
    }
  }
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
  if (placeholder) out.push({ kind: 'placeholder', text: norm(placeholder) });

  if (tag === 'img') {
    const alt = el.getAttribute('alt');
    if (alt) out.push({ kind: 'altText', text: norm(alt) });
  }

  const title = el.getAttribute('title');
  if (title) out.push({ kind: 'title', text: norm(title) });

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

  return { tag, role, accessibleName: name || null, candidates, preferredIndex };
}
