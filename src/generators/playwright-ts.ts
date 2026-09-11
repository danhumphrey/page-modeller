// Playwright, TypeScript (SPEC §12). The primary target.
//
// Not a translation of the Selenium template: the API differs enough to change
// the shape. See ts-page-object.ts for why there are no action wrappers.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import { playwrightExpr } from '../locators/display';
import { playwrightFramePrefix } from '../locators/frames';
import { tsPageObject, tsLocators, type TsTarget } from './ts-page-object';

const PLAYWRIGHT: TsTarget = {
  module: '@playwright/test',
  // frameLocator chains, so a framed element needs no explanation and no
  // switching — the locator is complete on its own (SPEC §16).
  expr: (el: ModelElement) => playwrightFramePrefix(el.framePath) + playwrightExpr(activeCandidate(el)),
};

export const generatePlaywrightPageObject = (model: TabModel) => tsPageObject(model, PLAYWRIGHT);
export const generatePlaywrightLocators = (model: TabModel) => tsLocators(model, PLAYWRIGHT);
