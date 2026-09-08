// How a locator reads in the model table.
//
// Selenium and Puppeteer show `type: value` (SPEC §6). Playwright shows the
// framework expression instead (SPEC §12) — `getByRole` takes a role AND a
// name, so there is no single value to put after a colon.
import type { LocatorCandidate } from '../engine/types';

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The Playwright call this candidate becomes. */
export function playwrightExpr(c: LocatorCandidate): string {
  switch (c.kind) {
    case 'testId':
      return `getByTestId(${q(c.value)})`;
    case 'role':
      // exact: true always — see SPEC §12 name matching.
      return c.name === undefined ? `getByRole(${q(c.role)})` : `getByRole(${q(c.role)}, { name: ${q(c.name)}, exact: true })`;
    case 'label':
      return `getByLabel(${q(c.text)}, { exact: true })`;
    case 'placeholder':
      return `getByPlaceholder(${q(c.text)})`;
    case 'text':
      return `getByText(${q(c.text)}, { exact: true })`;
    case 'altText':
      return `getByAltText(${q(c.text)})`;
    case 'title':
      return `getByTitle(${q(c.text)})`;
    case 'css':
    case 'xpath':
      return `locator(${q(c.value)})`;
  }
}

/** `type: value`, for frameworks whose locators are a flat pair. */
export function typeValue(c: LocatorCandidate): string {
  switch (c.kind) {
    case 'testId':
      return `testId: ${c.value}`;
    case 'role':
      return c.name === undefined ? `role: ${c.role}` : `role: ${c.role} — ${c.name}`;
    case 'label':
    case 'placeholder':
    case 'text':
    case 'altText':
    case 'title':
      return `${c.kind}: ${c.text}`;
    case 'css':
    case 'xpath':
      return `${c.kind}: ${c.value}`;
  }
}

export function displayLocator(c: LocatorCandidate, frameworkId: string): string {
  return frameworkId.startsWith('playwright') ? playwrightExpr(c) : typeValue(c);
}
