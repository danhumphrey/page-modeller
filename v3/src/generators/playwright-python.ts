// Playwright, Python (SPEC §12).
//
// The TypeScript page object in Python: locators bound in __init__, no action
// wrappers, no composite methods. Python has no `readonly`, so the annotation
// carries the intent and the convention carries the rest.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import { playwrightPyExpr } from '../locators/display';
import { classNameFor } from './class-name';
import { snake } from './names';

const expr = (el: ModelElement) => `page.${playwrightPyExpr(activeCandidate(el))}`;

export function generatePlaywrightPythonPageObject(model: TabModel): string {
  const className = classNameFor(model.url);
  const head = (locatorImport: boolean) => [
    `from playwright.sync_api import ${locatorImport ? 'Locator, Page' : 'Page'}`,
    '',
    '',
    `class ${className}:`,
    '    def __init__(self, page: Page) -> None:',
    '        self.page = page',
  ];

  if (model.elements.length === 0) return [...head(false), ''].join('\n');

  return [
    ...head(true),
    ...model.elements.map((el) => `        self.${snake(el.name)}: Locator = ${expr(el)}`),
    '',
  ].join('\n');
}

/** Locators only — bare assignments, for your own page-object conventions. */
export function generatePlaywrightPythonLocators(model: TabModel): string {
  return model.elements.map((el) => `${snake(el.name)} = ${expr(el)}`).join('\n');
}
