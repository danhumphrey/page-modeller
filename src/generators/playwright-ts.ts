// Playwright, TypeScript (SPEC §12). The primary target.
//
// Not a translation of the Selenium template: the API differs enough to change
// the shape. See ts-page-object.ts for why there are no action wrappers.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import { playwrightExpr } from '../locators/display';
import { playwrightFramePrefix } from '../locators/frames';
import { playwrightShadowPrefix } from '../locators/shadow';
import { tsPageObject, tsLocators, type TsTarget } from './ts-page-object';

const PLAYWRIGHT: TsTarget = {
  module: '@playwright/test',
  // frameLocator chains, so a framed element needs no explanation and no
  // switching — the locator is complete on its own (SPEC §16). A shadow path
  // chains the same way, with `locator(host)` per boundary: Playwright's own
  // engines pierce, so this is what separates two identical components rather
  // than what makes the element reachable at all (SPEC §19).
  expr: (el: ModelElement) =>
    playwrightFramePrefix(el.framePath) + playwrightShadowPrefix(el.shadowPath) + playwrightExpr(activeCandidate(el)),
};

export const generatePlaywrightPageObject = (model: TabModel) => tsPageObject(model, PLAYWRIGHT);
export const generatePlaywrightLocators = (model: TabModel) => tsLocators(model, PLAYWRIGHT);
