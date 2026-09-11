// Puppeteer (SPEC §11), in TypeScript — Puppeteer ships its own types and its
// docs are TS-first, so the annotations are the smaller edit to undo.
//
// Puppeteer 20 added `page.locator()`, a lazy auto-waiting handle much like
// Playwright's, so the page object is literally the same emitter. Before that
// there was only `page.$()`, which returns a handle that goes stale — hence
// SPEC's old note that Puppeteer has no locator API of its own. It does now.
//
// The selector spelling lives in locators/display.ts, so the table and the
// generated code cannot disagree about what a locator is.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import { puppeteerExpr } from '../locators/display';
import { frameNote, frameSelector } from '../locators/frames';
import { puppeteerShadowSelector, shadowContext } from '../locators/shadow';
import type { FrameStep } from '../engine/types';
import { singleQuoted as q } from '../quote';
import { tsPageObject, tsLocators, type TsTarget } from './ts-page-object';

/**
 * Puppeteer reaches a frame through the element that embeds it, so the snippet
 * walks down handle by handle and ends with the scope to use in place of
 * `page`.
 */
const frameSwitch = (path: FrameStep[]) => {
  const lines: string[] = [];
  let scope = 'page';
  path.forEach((step, i) => {
    const next = `frame${i + 1}`;
    lines.push(`const ${next} = await (await ${scope}.$(${q(frameSelector(step))})).contentFrame();`);
    scope = next;
  });
  lines.push(`Then use ${scope}.locator(...) in place of page.locator(...).`);
  return lines;
};

const PUPPETEER: TsTarget = {
  module: 'puppeteer',
  // A shadow element is reached with `>>>`, Puppeteer's deep descendant
  // combinator — its plain css does not pierce (SPEC §19). The selector goes
  // through puppeteerExpr first so the table and the code cannot disagree
  // about what the locator is, then the hosts are joined in front of it.
  expr: (el: ModelElement) => puppeteerShadowExpr(el),
  // `page.locator` is page-scoped and Puppeteer has no frameLocator, so a
  // framed element needs `page.frames()` first. Said out loud, because the
  // locator is otherwise indistinguishable from a main-frame one (SPEC §16).
  note: (el: ModelElement) => [...frameNote(el.framePath, '//', frameSwitch), ...shadowContext(el.shadowPath, '//')],
  // `Locator<T>` is generic over the node it yields — `page.locator('button')`
  // is a `Locator<HTMLButtonElement>`. Element is the common supertype, and
  // widening to it is what lets one field hold any of them.
  locatorType: 'Locator<Element>',
};

/**
 * `page.locator('host >>> input[name="x"]')`.
 *
 * Rebuilt from the selector rather than wrapped around the expression, because
 * the hosts belong INSIDE the quoted selector — prefixing the expression would
 * produce `page.locator('host').locator('input')`, which is Playwright's shape
 * and does not pierce in Puppeteer.
 */
function puppeteerShadowExpr(el: ModelElement): string {
  const base = puppeteerExpr(activeCandidate(el));
  if (!el.shadowPath?.length) return base;
  const m = base.match(/^locator\('([\s\S]*)'\)$/);
  // Anything not a plain single-quoted css selector is left alone: the shadow
  // path would have nowhere to go, and a wrong guess is worse than none.
  if (!m) return base;
  const inner = m[1].replace(/\\'/g, "'");
  return `locator(${q(puppeteerShadowSelector(el.shadowPath, inner))})`;
}

export const generatePuppeteerPageObject = (model: TabModel) => tsPageObject(model, PUPPETEER);
export const generatePuppeteerLocators = (model: TabModel) => tsLocators(model, PUPPETEER);
