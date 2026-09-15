// Which tree an element is counted and located within.
//
// Its own module because both `candidates.ts` and `naming.ts` need it and the
// first already imports the second, so this is the only place they can share.

/**
 * Duck-typed rather than `instanceof ShadowRoot`: this runs in a page, in
 * jsdom, and against the hand-built DOM stubs the naming tests use, and only
 * one of those three defines the constructor. `nodeType === 11` is
 * DOCUMENT_FRAGMENT_NODE, and `host` is what separates a shadow root from an
 * ordinary fragment.
 */
export function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node;
}

/**
 * The Document or ShadowRoot an element is scoped to (SPEC §19).
 *
 * Everything that asks "is this unique?" has to ask it of the right tree.
 * `ownerDocument` cannot see inside a shadow root at all, so every candidate
 * for a shadow element was rejected as matching zero elements, and the `>`
 * path then walked up to a `parentElement` of null and stopped mid-component.
 *
 * Scoping to the root is also what the generated locator does: a shadow
 * element's locator is relative to its root, reached through the host chain.
 * Ids are scoped to a shadow root, so a path anchored inside one is shorter
 * and steadier than a document-wide path could be.
 */
export function rootOf(el: Element): Document | ShadowRoot {
  const root = el.getRootNode();
  return isShadowRoot(root) ? root : el.ownerDocument;
}

/**
 * A class name, escaped for use in a selector.
 *
 * Tailwind alone produces `md:flex`, `w-1/2` and `p-[3px]`, every one of which
 * is a syntax error unescaped — and `querySelectorAll` THROWS on a malformed
 * selector rather than returning nothing, so it would take the whole pick with
 * it. `CSS.escape` is absent outside a browser, hence the fallback.
 */
export function escapeClass(cls: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(cls);
  return cls.replace(/[^\w-]/g, (c) => `\\${c}`);
}
