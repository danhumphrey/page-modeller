import type { LocatorCandidate } from '../engine/types';
import type { Generator, PomModel } from './types';

// Double-quoted, safely escaped string literal.
const s = (v: string): string => JSON.stringify(v);

/** IR candidate → Playwright locator expression (without the leading `this.page.`). */
export function candidateExpr(c: LocatorCandidate): string {
  switch (c.kind) {
    case 'testId':
      return `getByTestId(${s(c.value)})`;
    case 'role': {
      if (c.name === undefined) return `getByRole(${s(c.role)})`;
      const opts = [`name: ${s(c.name)}`];
      if (c.exact) opts.push('exact: true');
      return `getByRole(${s(c.role)}, { ${opts.join(', ')} })`;
    }
    case 'label':
      return c.exact ? `getByLabel(${s(c.text)}, { exact: true })` : `getByLabel(${s(c.text)})`;
    case 'placeholder':
      return `getByPlaceholder(${s(c.text)})`;
    case 'text':
      return c.exact ? `getByText(${s(c.text)}, { exact: true })` : `getByText(${s(c.text)})`;
    case 'altText':
      return `getByAltText(${s(c.text)})`;
    case 'title':
      return `getByTitle(${s(c.text)})`;
    case 'css':
      return `locator(${s(c.value)})`;
    case 'xpath':
      return `locator(${s(`xpath=${c.value}`)})`;
  }
}

function generate(model: PomModel): string {
  const className = /^[A-Za-z_$][\w$]*$/.test(model.className) ? model.className : 'GeneratedPage';
  const L: string[] = [];
  L.push(`import { type Page, type Locator } from '@playwright/test';`, '');
  L.push(`export class ${className} {`);
  L.push(`  readonly page: Page;`);
  for (const el of model.elements) L.push(`  readonly ${el.name}: Locator;`);
  L.push('');
  L.push(`  constructor(page: Page) {`);
  L.push(`    this.page = page;`);
  for (const el of model.elements) {
    L.push(`    this.${el.name} = this.page.${candidateExpr(el.candidate)};`);
  }
  L.push(`  }`);
  if (model.url) {
    L.push('');
    L.push(`  async goto() {`);
    L.push(`    await this.page.goto(${s(model.url)});`);
    L.push(`  }`);
  }
  L.push(`}`);
  return L.join('\n') + '\n';
}

export const playwrightTs: Generator = {
  id: 'playwright-ts',
  label: 'Playwright (TypeScript)',
  ext: 'ts',
  generate,
};
