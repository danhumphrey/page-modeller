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
      if (c.name === undefined) return `getByRole(${q(c.role)})`;
      return `getByRole(${q(c.role)}, { name: ${q(c.name)}${c.exact ? ', exact: true' : ''} })`;
    case 'label':
      return `getByLabel(${q(c.text)}${c.exact ? ', { exact: true }' : ''})`;
    case 'placeholder':
      return `getByPlaceholder(${q(c.text)}${c.exact ? ', { exact: true }' : ''})`;
    case 'text':
      return `getByText(${q(c.text)}${c.exact ? ', { exact: true }' : ''})`;
    case 'altText':
      return `getByAltText(${q(c.text)}${c.exact ? ', { exact: true }' : ''})`;
    case 'title':
      return `getByTitle(${q(c.text)}${c.exact ? ', { exact: true }' : ''})`;
    case 'css':
      return `locator(${q(c.value)})`;
    case 'xpath':
      // The `xpath=` prefix is not optional. Playwright only infers XPath from
      // a leading `//` or `..`, and the engine's fallback path starts with a
      // single `/` — `locator('/html[1]/body[1]/div[2]')` is parsed as CSS and
      // throws "Unexpected token /".
      return `locator(${q(`xpath=${c.value}`)})`;
    default:
      // Selenium's By strategies have no Playwright call. They should not reach
      // a Playwright model, but if one is hand-typed and the framework changes,
      // show it plainly rather than inventing an expression.
      return typeValue(c);
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
    case 'id':
    case 'name':
    case 'className':
    case 'tagName':
      return `${c.kind}: ${c.value}`;
    case 'linkText':
    case 'partialLinkText':
      return `${c.kind}: ${c.text}`;
  }
}

export function displayLocator(c: LocatorCandidate, frameworkId: string): string {
  return frameworkId.startsWith('playwright') ? playwrightExpr(c) : typeValue(c);
}
