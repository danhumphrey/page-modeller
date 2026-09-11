/**
 * jsdom cannot compute pseudo-element styles and announces it once per call,
 * straight to the process's stderr — below vitest's console, so neither
 * `onConsoleLog` nor a `console.error` filter reaches it.
 *
 * The engine asks for them because real browsers answer: a button's whole
 * label can live in `::before` (see `pseudoText`). jsdom already ignores the
 * pseudo argument and returns the element's own style, so dropping it here
 * changes nothing except the 56 identical lines it prints — enough noise to
 * bury something that matters.
 *
 * Scoped to the argument jsdom cannot serve. Every other call is untouched,
 * and node-environment tests have no `window` to patch.
 */
if (typeof window !== 'undefined') {
  const real = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((el: Element, pseudo?: string | null) =>
    pseudo ? real(el) : real(el, pseudo)) as typeof window.getComputedStyle;
}
