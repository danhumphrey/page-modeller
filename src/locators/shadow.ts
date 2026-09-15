// How a shadow path reads in each target (SPEC §19).
//
// The sibling of frames.ts, and the same split: Playwright and Puppeteer carry
// the chain inside the locator, so their output stays self-contained. Selenium
// cannot — a `By` is tree-agnostic — so it walks the hosts one `shadowRoot` at
// a time, and the expression that finds the element changes rather than a
// comment being added.
//
// Unlike a frame switch, nothing here mutates driver state: a shadow root is
// reached by chaining off an element, so there is no default content to return
// to and no `finally` to write.
import type { ShadowStep } from '../engine/types';
import { singleQuoted, doubleQuoted } from '../quote';

/**
 * The selector for one host. Always css: every API that enters a shadow root
 * takes one, and xpath cannot address a shadow tree in any engine — measured
 * in `tests/shadow.probe.spec.ts`, where WebDriver answers `invalid locator`
 * and Playwright resolves zero.
 */
export function shadowSelector(step: ShadowStep): string {
  return (step.host as { value: string }).value;
}

/**
 * Optional throughout, as frame paths are: `storage.session` survives an
 * extension reload, so elements captured before shadow support existed still
 * arrive without one.
 */
type Path = ShadowStep[] | undefined;

export const hasShadow = (path: Path) => (path ?? []).length > 0;

/**
 * `locator('outer-panel').locator('inner-field').`, or '' in the light DOM.
 *
 * Playwright's own engines pierce, so a locator generated as though the page
 * were flat already resolves — but the chain is still emitted, because it is
 * what separates two identical components, and because a locator that says
 * where the element lives survives a page growing a second one.
 */
export function playwrightShadowPrefix(path: Path): string {
  return (path ?? []).map((s) => `locator(${singleQuoted(shadowSelector(s))}).`).join('');
}

/** The Python spelling of the same chain. */
export function playwrightPyShadowPrefix(path: Path): string {
  return (path ?? []).map((s) => `locator(${doubleQuoted(shadowSelector(s))}).`).join('');
}

/**
 * Puppeteer joins the hosts to the element's own selector with `>>>`, its deep
 * descendant combinator. One `>>>` spans any depth, so this is more explicit
 * than it strictly needs to be — and stays correct when a page grows a second
 * component that the outermost host alone would no longer separate.
 */
export function puppeteerShadowSelector(path: Path, selector: string): string {
  return [...(path ?? []).map(shadowSelector), selector].join(' >>> ');
}

/**
 * The receiver a Selenium `find` runs against: the driver, or a chain of hosts
 * ending in a `shadowRoot`.
 *
 * `step` is supplied per language because only the spelling differs —
 * `.shadow_root`, `.getShadowRoot()`, `.GetShadowRoot()` — and each already
 * has its own `By` builder and its own find call.
 */
export function seleniumShadowRoot(path: Path, base: string, step: (recv: string, hostCss: string) => string): string {
  return (path ?? []).reduce((recv, s) => step(recv, shadowSelector(s)), base);
}

/**
 * What to say in a banner above a shadow-bound definition.
 *
 * Worth saying even where the locator carries the chain itself: "this element
 * is inside a web component" is why its locator looks the way it does, and a
 * reader pasting it somewhere else needs to know the host has to exist.
 */
export function shadowContext(path: Path, comment: string): string[] {
  if (!hasShadow(path)) return [];
  return [`${comment} In shadow DOM: ${(path ?? []).map(shadowSelector).join(' \u203a ')}`];
}

/**
 * The note a shadow-bound locator needs in a shape that cannot carry the
 * chain — Selenium's locators-only, where the output is a bare `By` and the
 * call site supplies the receiver.
 *
 * Without it the constant is indistinguishable from a light-DOM one and
 * `driver.find_element(*COUPON)` silently finds nothing: the driver cannot see
 * into a shadow root at all, which `tests/shadow.probe.spec.ts` measures.
 *
 * Carries the traversal itself rather than an instruction to write one, so the
 * reader can paste it — the same choice `frameNote` makes.
 */
export function shadowNote(path: Path, comment: string, howTo: (path: ShadowStep[]) => string[]): string[] {
  if (!hasShadow(path)) return [];
  return [
    `In shadow DOM: ${(path ?? []).map(shadowSelector).join(' \u203a ')}`,
    ...howTo(path ?? []),
  ].map((line) => `${comment} ${line}`);
}
