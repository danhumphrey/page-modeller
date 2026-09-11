import { computeAccessibleName, getRole } from 'dom-accessibility-api';
import type { LocatorCandidate, ElementResult, FrameStep, RankedCandidate, ShadowStep } from './types';
import { baseName, looksGenerated } from './naming';

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

export function safeName(el: Element): string {
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

export function safeRole(el: Element): string | null {
  try {
    return getRole(el) || null;
  } catch {
    return null;
  }
}

/**
 * The Document or ShadowRoot an element is scoped to (SPEC §19).
 *
 * Everything that asks "is this selector unique?" has to ask it of the right
 * tree. `ownerDocument` cannot see inside a shadow root at all, so every
 * candidate for a shadow element was rejected as matching zero elements, and
 * the `>` path then walked up to a `parentElement` of null and stopped
 * mid-component.
 *
 * Scoping to the root is also what the generated locator does: a shadow
 * element's locator is relative to its root, reached through the host chain.
 * Ids are scoped to a shadow root, so a path anchored inside one is shorter
 * and steadier than a document-wide path could be.
 */
export function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node;
}

export function rootOf(el: Element): Document | ShadowRoot {
  const root = el.getRootNode();
  return isShadowRoot(root) ? root : el.ownerDocument;
}

// ---- selector builders (deterministic fallbacks) ----

/**
 * An attribute selector, if it singles the element out.
 *
 * CSS is not only a structural fallback: for Puppeteer it is the ONLY
 * expressible type (SPEC §7), so whatever preference the other frameworks get
 * from their locator-type ordering, Puppeteer can only get from here.
 */
/**
 * The attribute a test id lives in. Configurable because Playwright, Cypress
 * and Testing Library all let a project choose, and `data-qa` and `data-test`
 * are common (SPEC §12).
 *
 * Module state rather than a parameter: the engine runs once per document, and
 * threading it through every caller — including the fidelity harness, which
 * has no settings — would buy nothing. Set from settings when the content
 * script loads; the default is what Playwright itself defaults to.
 */
let testIdAttribute = 'data-testid';

export function setTestIdAttribute(attr: string): void {
  testIdAttribute = attr.trim() || 'data-testid';
}

function attrSelector(el: Element, attr: string): string | null {
  const value = el.getAttribute(attr);
  if (!value) return null;
  // Tag-qualified for the weaker attributes: `[type="submit"]` says nothing on
  // its own, `button[type="submit"]` is a locator. Uniqueness is still what
  // decides, so qualifying can only ever help.
  const prefix = attr === testIdAttribute || attr === 'name' ? '' : el.localName;
  // A quoted attribute value is a CSS *string*, where only `\` and `"` need
  // escaping. CSS.escape is for identifiers and would render `/forgot` as
  // `\/forgot` — still valid, but nobody writes that.
  const sel = `${prefix}[${attr}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  return rootOf(el).querySelectorAll(sel).length === 1 ? sel : null;
}

/** `#id`, unless the id is framework-generated — same rule as the id candidate. */
function idSelector(el: Element): string | null {
  const id = el.getAttribute('id');
  if (!id || looksGenerated(id)) return null;
  const sel = `#${CSS.escape(id)}`;
  return rootOf(el).querySelectorAll(sel).length === 1 ? sel : null;
}

/**
 * Attributes worth building a selector from, in order of how much a person
 * meant them. Anything here is authored: none of it is emitted by a framework
 * the way ids are, and none of it is positional the way a `>` path is.
 *
 * The tail matters most for Puppeteer, whose only other option is that path —
 * `a[href="/forgot"]` instead of seven levels of `div:nth-of-type`.
 */
const CSS_ATTRS = ['name', 'aria-label', 'placeholder', 'alt', 'title', 'href', 'type'];

function cssFor(el: Element): string {
  // A test id is the most change-resistant, then an author-chosen name, then an
  // id — which is only author-chosen when it does not look generated. React's
  // useId gave Facebook's email field `id="_R_1h6kqsqppb6amH1_"` next to
  // `name="email"`.
  const direct =
    attrSelector(el, testIdAttribute) ??
    attrSelector(el, 'name') ??
    idSelector(el) ??
    CSS_ATTRS.reduce<string | null>((found, attr) => found ?? attrSelector(el, attr), null);
  if (direct) return direct;

  const parts: string[] = [];
  let cur: Element | null = el;
  // Inside a shadow root the topmost element's `parentElement` is already
  // null — its parent is the root, which is not an Element — so the walk stops
  // at the boundary on its own, and the path is relative to the root.
  const stopAt = isShadowRoot(rootOf(el)) ? null : el.ownerDocument.documentElement;
  while (cur && cur.nodeType === 1 && cur !== stopAt) {
    // Anchoring the path on a generated id would defeat the point.
    const anchor = idSelector(cur);
    if (anchor) {
      parts.unshift(anchor);
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

const HTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * One step of an XPath.
 *
 * An unprefixed name test matches the null namespace; browsers special-case
 * HTML-namespace elements in an HTML document, but nothing else — so `svg[1]`
 * matches nothing, and every path through an <svg> resolved to zero. Elements
 * outside the HTML namespace are matched on `local-name()`, which sidesteps
 * namespaces entirely.
 *
 * `localName` rather than a lowercased `tagName`: SVG names are case-sensitive
 * and some are camelCase (`clipPath`, `linearGradient`).
 */
function xpathStep(el: Element, index: number): string {
  return el.namespaceURI === HTML_NS
    ? `${el.localName}[${index}]`
    : `*[local-name()=${JSON.stringify(el.localName)}][${index}]`;
}

function xpathFor(el: Element): string {
  if (el.id) return `//*[@id=${JSON.stringify(el.id)}]`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1) {
    const parent: Element | null = cur.parentElement;
    let idx = 1;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (same.length > 1) idx = same.indexOf(cur) + 1;
    }
    parts.unshift(xpathStep(cur, idx));
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
export function ariaHidden(el: Element): boolean {
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

/**
 * Every element the candidate matches, in tree order.
 *
 * `root` is a Document or a ShadowRoot (SPEC §19). A shadow element's locator
 * is relative to its root, so the eye has to resolve it there — resolving in
 * the document would report zero for a locator that works, and piercing from
 * the document would report a count no framework will reproduce.
 *
 * A ShadowRoot is a DocumentFragment, so it has querySelectorAll but NOT
 * getElementsByClassName, getElementsByTagName or evaluate. The first two have
 * exact selector equivalents. The third does not, and does not need one: XPath
 * cannot address a shadow tree in any engine — Playwright resolves zero,
 * WebDriver answers `invalid locator` — which is why §19 excludes xpath for a
 * shadow element rather than trying to emit one.
 */
/**
 * querySelectorAll, descending into open shadow roots.
 *
 * Playwright's engines pierce, and the eye reports what a Playwright test will
 * get — so a resolver that stopped at the boundary under-counted. A plain
 * `<button>Submit</button>` on a page of web components each containing their
 * own Submit read as unique here and resolved to six in a real run.
 *
 * Piercing downward is right for every scope: a locator scoped to a shadow
 * root still sees roots nested below it, both for us and for Playwright.
 *
 * Selenium does not pierce, so where the two differ this reports MORE matches
 * than a Selenium run would. That direction is the safe one: an amber
 * "6 elements match" sends the user to look, where a green tick on a locator
 * that matches six would not (SPEC §7, §19).
 */
function pierce(root: Document | ShadowRoot | Element, sel: string): Element[] {
  const out = Array.from(root.querySelectorAll(sel));
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.shadowRoot) out.push(...pierce(el.shadowRoot, sel));
  }
  return out;
}

/**
 * Elements that render no text of their own. Playwright's text engine ignores
 * them; ours counted `<title>` as a match for the page heading, because a
 * document's title so often repeats it.
 */
const NON_RENDERED = new Set(['TITLE', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK']);

export function resolveCandidate(root: Document | ShadowRoot, c: LocatorCandidate): Element[] {
  const doc = root;
  const all = () => pierce(doc, '*').filter((e) => !NON_RENDERED.has(e.tagName));
  switch (c.kind) {
    case 'testId':
      return pierce(doc, `[${testIdAttribute}="${CSS.escape(c.value)}"]`);
    case 'role':
      return all()
        .filter((e) => safeRole(e) === c.role && (c.name === undefined || matchesText(safeName(e), c.name, c.exact)))
        .filter((e) => !ariaHidden(e));
    case 'label':
      return all().filter((e) => LABEL_TARGETS.has(e.tagName) && matchesText(safeName(e), c.text, c.exact));
    case 'placeholder':
      return pierce(doc, '[placeholder]').filter((e) =>
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
      return pierce(doc, 'img[alt], input[alt], area[alt]').filter((e) =>
        matchesText(e.getAttribute('alt') ?? '', c.text, c.exact)
      );
    case 'title':
      return pierce(doc, '[title]').filter((e) => matchesText(e.getAttribute('title') ?? '', c.text, c.exact));
    case 'css':
      // A hand-typed selector can be invalid; that is a miss, not a crash.
      try {
        return pierce(doc, c.value);
      } catch {
        return [];
      }
    case 'xpath': {
      // No engine can XPath into a shadow tree, so neither do we.
      if (isShadowRoot(doc)) return [];
      try {
        const r = doc.evaluate(c.value, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return Array.from({ length: r.snapshotLength }, (_, i) => r.snapshotItem(i) as Element);
      } catch {
        return [];
      }
    }

    // Selenium's By strategies, so the eye can test a hand-typed one.
    case 'id':
      return c.value ? pierce(doc, `#${CSS.escape(c.value)}`) : [];
    case 'name':
      return c.value ? pierce(doc, `[name="${CSS.escape(c.value)}"]`) : [];
    case 'className':
      // By.className takes ONE class name, not a selector. Expressed as a
      // selector because a ShadowRoot has no getElementsByClassName.
      return c.value ? pierce(doc, `.${CSS.escape(c.value)}`) : [];
    case 'tagName':
      return c.value ? pierce(doc, CSS.escape(c.value)) : [];
    case 'linkText':
      // Selenium matches links on their rendered text, trimmed.
      return pierce(doc, 'a').filter((a) => norm(a.textContent) === norm(c.text));
    case 'partialLinkText':
      return pierce(doc, 'a').filter((a) => norm(a.textContent).includes(norm(c.text)));
  }
}

// ---- candidate generation (ranked, mirrors Playwright's priority) ----

/**
 * The chain of frames between the main document and this element's document,
 * outermost first (SPEC §16).
 *
 * Each frame is located with the ordinary candidate machinery: the document
 * holding an `<iframe>` is just a document, and the `<iframe>` is just an
 * element in it. So a frame gets the same testid/name/id/attribute preference
 * as anything else, and the same uniqueness check.
 *
 * `window.frameElement` is the whole trick, and its limit is the whole
 * difficulty: it is readable only when the parent is same-origin. Across an
 * origin it throws, and a document cannot see what embeds it — so the chain
 * stops there and says so rather than returning a path that starts halfway
 * down and looks complete.
 */
export function framePathOf(win: Window | null): FrameStep[] {
  const path: FrameStep[] = [];
  if (!win) return path;
  let cur: Window = win;

  // A bounded walk: a malformed or hostile tree should not spin here.
  for (let depth = 0; depth < 32 && cur !== cur.top; depth++) {
    let el: Element | null = null;
    try {
      el = cur.frameElement;
    } catch {
      el = null; // cross-origin parent
    }
    if (!el) {
      path.unshift({ frame: { kind: 'css', value: ':root' }, opaque: true });
      break;
    }
    // Generated against the PARENT document, which is where the frame element
    // lives and where it has to be unique.
    //
    // Restricted to css/xpath, unlike an ordinary element: `frameLocator` takes
    // a SELECTOR, not a locator, so `getByTitle('Payment')` cannot address a
    // frame however well it identifies one. Selenium and Puppeteer are the same
    // — every frame API in reach speaks selectors. cssFor already prefers a
    // test id, then name, then id, so this loses little.
    const ranked = rankFor(el, safeRole(el), safeName(el)).filter(
      (c) => c.candidate.kind === 'css' || c.candidate.kind === 'xpath'
    );
    const best = ranked[chooseFirstUnique(ranked)] ?? ranked[0];
    if (!best) break;
    path.unshift({ frame: best.candidate });
    cur = cur.parent;
  }

  return path;
}

/** Index of the first predicted-unique candidate, or 0 when none is. */
function chooseFirstUnique(ranked: RankedCandidate[]): number {
  const i = ranked.findIndex((c) => c.predictedCount === 1);
  return i === -1 ? 0 : i;
}

/**
 * How the parent document addresses one of its frames. css or xpath only:
 * `frameLocator` takes a selector, not a locator, and so does every other
 * frame API in reach.
 */
export function frameStepFor(frame: Element): FrameStep {
  const ranked = rankFor(frame, safeRole(frame), safeName(frame)).filter(
    (c) => c.candidate.kind === 'css' || c.candidate.kind === 'xpath'
  );
  const best = ranked[chooseFirstUnique(ranked)] ?? ranked[0];
  return { frame: best?.candidate ?? { kind: 'css', value: frame.localName } };
}

/**
 * The chain of shadow hosts between this element's document and the element,
 * outermost first (SPEC §19).
 *
 * Walked from the element outwards: each `getRootNode()` that is a ShadowRoot
 * contributes its host, and the walk continues from that host — which may
 * itself sit in another shadow root.
 *
 * Every host is located in ITS OWN tree, which `rankFor` already does via
 * `rootOf`, so a component nested inside another component gets a selector
 * that is unique where it is used rather than where it is read.
 */
export function shadowPathOf(el: Element): ShadowStep[] {
  const path: ShadowStep[] = [];
  let node: Node = el;

  // Bounded, as framePathOf is: a malformed tree must not spin here.
  for (let depth = 0; depth < 32; depth++) {
    const root = node.getRootNode();
    if (!isShadowRoot(root)) break;
    const host = root.host;
    path.unshift({ host: hostCandidate(host) });
    node = host;
  }
  return path;
}

/**
 * A host's selector. css only — `>>>` and `shadowRoot` both take one — and
 * never xpath, which cannot address a shadow tree and so could not be used to
 * reach a host nested inside one.
 */
function hostCandidate(host: Element): LocatorCandidate {
  const ranked = rankFor(host, safeRole(host), safeName(host)).filter((c) => c.candidate.kind === 'css');
  const best = ranked[chooseFirstUnique(ranked)] ?? ranked[0];
  return best?.candidate ?? { kind: 'css', value: host.localName };
}

/** A selector string for a shadow step. */
export function shadowSelector(step: ShadowStep): string {
  return (step.host as { value: string }).value;
}

/** A selector string for a frame step, for the APIs that take one. */
export function frameSelector(step: FrameStep): string {
  return step.frame.kind === 'xpath' ? `xpath=${step.frame.value}` : (step.frame as { value: string }).value;
}

/**
 * Every candidate for an element, filtered to those that actually find it and
 * ranked by predicted uniqueness. Shared by `generate` and by `framePathOf`,
 * which needs exactly this for an `<iframe>` in its parent document.
 */
function rankFor(el: Element, role: string | null, name: string): RankedCandidate[] {
  // The element's own tree, which for shadow content is its root rather than
  // the document (SPEC §19). Also what drops the xpath candidate for a shadow
  // element without a special case: no engine can XPath into a shadow tree, so
  // `resolveCandidate` finds nothing and the filter below removes it.
  const doc = rootOf(el);
  const tag = el.tagName.toLowerCase();
  const out: LocatorCandidate[] = [];

  const testId = el.getAttribute(testIdAttribute);
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

  // ---- Selenium's By strategies ----
  //
  // Generated for every element regardless of the chosen framework: the model
  // holds the superset and the framework decides which are expressible. Without
  // these, a Selenium target had nothing but css and xpath, and would happily
  // select a `role` locator Selenium cannot write.
  const id = el.getAttribute('id');
  if (id && !looksGenerated(id)) out.push({ kind: 'id', value: id });

  const nameAttr = el.getAttribute('name');
  if (nameAttr) out.push({ kind: 'name', value: nameAttr });

  // By.className takes ONE class name, so each is its own candidate. Capped,
  // and build-generated names skipped, or a CSS-in-JS page yields a dropdown of
  // hashes that change on their next deploy.
  for (const cls of Array.from(el.classList).filter((c) => !looksGenerated(c)).slice(0, 3)) {
    out.push({ kind: 'className', value: cls });
  }

  out.push({ kind: 'tagName', value: el.localName });

  if (el.localName === 'a') {
    const linkText = norm(el.textContent);
    if (linkText) {
      out.push({ kind: 'linkText', text: linkText });
      out.push({ kind: 'partialLinkText', text: linkText });
    }
  }

  out.push({ kind: 'css', value: cssFor(el) });
  out.push({ kind: 'xpath', value: xpathFor(el) });

  // Keep only candidates that actually find THIS element. A locator can be
  // well-formed, resolve to something, and still be useless: getByRole excludes
  // a11y-hidden elements, so a hidden button's role candidate finds the other
  // buttons; getByText matches the innermost element, so a <fieldset>'s text
  // candidate finds its <legend>. Offering those in the Edit dialog would hand
  // the user a locator that cannot work.
  const candidates: RankedCandidate[] = out
    .map((candidate) => ({ candidate, matches: resolveCandidate(doc, candidate) }))
    .filter(({ matches }) => matches.includes(el))
    .map(({ candidate, matches }) => ({ candidate, predictedCount: matches.length }));

  return candidates;
}

export function generate(el: Element, framePath?: FrameStep[]): ElementResult {
  const role = safeRole(el);
  const name = safeName(el);
  const tag = el.tagName.toLowerCase();
  const candidates = rankFor(el, role, name);

  return {
    tag,
    role,
    accessibleName: name || null,
    suggestedName: baseName(el),
    inputType: tag === 'input' ? (el as HTMLInputElement).type : undefined,
    candidates,
    preferredIndex: candidates.findIndex((c) => c.predictedCount === 1),
    // The document this element lives in may be framed; the chain to it is as
    // much a part of the locator as the locator (SPEC §16). Supplied by the
    // caller, because only the top frame can see the whole chain — see
    // `frameStepFor` and the FRAME_PATH broadcast in the content script.
    framePath: framePath ?? framePathOf(el.ownerDocument.defaultView),
    // And the chain of components around it, for the same reason (SPEC §19).
    // Read here rather than supplied: unlike a frame chain, every host is
    // visible from the element itself, so nothing has to be pushed down.
    shadowPath: shadowPathOf(el),
  };
}
