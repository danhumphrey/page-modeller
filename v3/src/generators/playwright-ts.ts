// Playwright, TypeScript (SPEC §12). The primary target.
//
// Not a translation of the Selenium template: the API differs enough to change
// the shape. Locators are lazy, so a getter costs nothing and never goes stale;
// auto-waiting removes explicit waits; and `fill`, `check` and `selectOption`
// replace several hand-rolled sequences.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import { playwrightExpr } from '../locators/display';
import { classNameFor } from './class-name';
import { lowerCamel } from './names';

/** `page.getByRole(…)` for one element. */
function expr(el: ModelElement): string {
  return `page.${playwrightExpr(activeCandidate(el))}`;
}

/**
 * The idiomatic page object: readonly locators assigned in the constructor,
 * which is the shape Playwright's own documentation shows.
 *
 * No per-element action wrappers, deliberately. A `Locator` is lazy, reusable
 * and *is* the action API, so `clickLogIn()` around `.click()` adds a name and
 * nothing else — the test reads better as `loginPage.logIn.click()`. Those
 * wrappers earn their place in Selenium, where `findElement` returns something
 * that goes stale; here they are ceremony.
 *
 * Composite methods — `login(email, password)` — are the point of a page
 * object, and they need domain knowledge this tool does not have. The user
 * writes those.
 */
export function generatePlaywrightPageObject(model: TabModel): string {
  const className = classNameFor(model.url);
  if (model.elements.length === 0) {
    return [
      "import { type Page } from '@playwright/test';",
      '',
      `export class ${className} {`,
      '  constructor(private readonly page: Page) {}',
      '}',
      '',
    ].join('\n');
  }

  const fields = model.elements.map((el) => `  readonly ${lowerCamel(el.name)}: Locator;`);
  const assignments = model.elements.map((el) => `    this.${lowerCamel(el.name)} = ${expr(el)};`);

  return [
    "import { type Locator, type Page } from '@playwright/test';",
    '',
    `export class ${className} {`,
    ...fields,
    '',
    '  constructor(private readonly page: Page) {',
    ...assignments,
    '  }',
    '}',
    '',
  ].join('\n');
}

/**
 * Locators only (SPEC §11) — the escape hatch for anyone with their own page
 * object conventions, which is most teams. Our locators, none of our opinions.
 */
export function generatePlaywrightLocators(model: TabModel): string {
  return model.elements.map((el) => `const ${lowerCamel(el.name)} = ${expr(el)};`).join('\n');
}
