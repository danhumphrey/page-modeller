// Puppeteer (SPEC §11), in TypeScript — Puppeteer ships its own types and its
// docs are TS-first, so the annotations are the smaller edit to undo.
//
// Puppeteer 20 added `page.locator()`, a lazy auto-waiting handle much like
// Playwright's, so the page object is literally the same emitter. Before that
// there was only `page.$()`, which returns a handle that goes stale — hence
// SPEC's old note that Puppeteer has no locator API of its own. It does now.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import type { LocatorCandidate } from '../engine/types';
import { tsPageObject, tsLocators, type TsTarget } from './ts-page-object';

const q = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * Puppeteer takes XPath with an `xpath/` prefix, not Playwright's `xpath=`.
 * Everything after that first `/` is the expression, so an absolute path
 * doubles the slash — `xpath//html[1]/body[1]` is correct, not a typo.
 *
 * Unlike the Playwright output, this is not resolved against a real Puppeteer
 * anywhere in the test suite; Puppeteer is not a dependency here.
 */
function selector(c: LocatorCandidate): string {
  if (c.kind === 'xpath') return q(`xpath/${c.value}`);
  if (c.kind === 'css') return q(c.value);
  return `/* ${c.kind} is not expressible in Puppeteer */`;
}

const PUPPETEER: TsTarget = {
  module: 'puppeteer',
  expr: (el: ModelElement) => `locator(${selector(activeCandidate(el))})`,
};

export const generatePuppeteerPageObject = (model: TabModel) => tsPageObject(model, PUPPETEER);
export const generatePuppeteerLocators = (model: TabModel) => tsLocators(model, PUPPETEER);
