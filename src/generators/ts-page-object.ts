// The TypeScript page object, shared by Playwright and Puppeteer (SPEC §12).
//
// Both libraries expose a lazy `Locator` created from a `Page`, so both take
// the same shape: readonly fields assigned in the constructor, no per-element
// action wrappers, no composite methods. One emitter, so they cannot drift —
// they differ only in which module the types come from and how an expression
// is spelled.
import type { ModelElement, TabModel } from '../model';
import { classNameFor } from './class-name';
import { jsName, lowerCamel } from './names';

export interface TsTarget {
  /** The package `Locator` and `Page` are imported from. */
  module: string;
  /** The call, without the leading `page.` */
  expr: (el: ModelElement) => string;
  /** Comment lines to place above an element, when it needs any. */
  note?: (el: ModelElement) => string[];
  /**
   * How to write the field's type. Playwright's `Locator` is plain; Puppeteer's
   * is generic over the node it yields, so a bare `Locator` does not compile.
   */
  locatorType?: string;
}

export function tsPageObject(model: TabModel, target: TsTarget): string {
  const className = classNameFor(model.url);

  if (model.elements.length === 0) {
    return [
      `import { type Page } from '${target.module}';`,
      '',
      `export class ${className} {`,
      '  constructor(private readonly page: Page) {}',
      '}',
      '',
    ].join('\n');
  }

  return [
    `import { type Locator, type Page } from '${target.module}';`,
    '',
    `export class ${className} {`,
    ...model.elements.map((el) => `  readonly ${jsName(lowerCamel(el.name))}: ${target.locatorType ?? 'Locator'};`),
    '',
    // Assignment reads the constructor PARAMETER, not `this.page`: a parameter
    // property is not assigned until the constructor body completes.
    '  constructor(private readonly page: Page) {',
    ...model.elements.flatMap((el) => [
      ...(target.note?.(el) ?? []).map((line) => `    ${line}`),
      `    this.${jsName(lowerCamel(el.name))} = page.${target.expr(el)};`,
    ]),
    '  }',
    '}',
    '',
  ].join('\n');
}

/** Locators only — no class, and the types are inferred. */
export function tsLocators(model: TabModel, target: TsTarget): string {
  return model.elements
    .flatMap((el) => [...(target.note?.(el) ?? []), `const ${jsName(lowerCamel(el.name))} = page.${target.expr(el)};`])
    .join('\n');
}
