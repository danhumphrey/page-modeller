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
import { tsPageObject, tsLocators, type TsTarget } from './ts-page-object';

const PUPPETEER: TsTarget = {
  module: 'puppeteer',
  expr: (el: ModelElement) => puppeteerExpr(activeCandidate(el)),
};

export const generatePuppeteerPageObject = (model: TabModel) => tsPageObject(model, PUPPETEER);
export const generatePuppeteerLocators = (model: TabModel) => tsLocators(model, PUPPETEER);
