// Puppeteer (SPEC §11). JavaScript — the framework is not language-qualified,
// and JS is where Puppeteer users start.
//
// Puppeteer 20 added `page.locator()`, a lazy auto-waiting handle much like
// Playwright's, so the page object takes the same shape: bind in the
// constructor, wrap nothing. Before that there was only `page.$()`, which
// returns a handle that goes stale — hence SPEC's old note that Puppeteer has
// no locator API of its own. It does now.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import type { LocatorCandidate } from '../engine/types';
import { classNameFor } from './class-name';
import { lowerCamel } from './names';

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

const expr = (el: ModelElement) => `page.locator(${selector(activeCandidate(el))})`;

export function generatePuppeteerPageObject(model: TabModel): string {
  const className = classNameFor(model.url);
  return [
    `export class ${className} {`,
    '  constructor(page) {',
    '    this.page = page;',
    ...model.elements.map((el) => `    this.${lowerCamel(el.name)} = ${expr(el)};`),
    '  }',
    '}',
    '',
  ].join('\n');
}

/** Locators only — bare consts, for your own page-object conventions. */
export function generatePuppeteerLocators(model: TabModel): string {
  return model.elements.map((el) => `const ${lowerCamel(el.name)} = ${expr(el)};`).join('\n');
}
