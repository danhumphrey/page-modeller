// How a locator reads in the model table.
//
// Selenium and Puppeteer show `type: value` (SPEC §6). Playwright shows the
// framework expression instead (SPEC §12) — `getByRole` takes a role AND a
// name, so there is no single value to put after a colon.
import type { LocatorCandidate } from '../engine/types';

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const qq = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

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

/**
 * The Playwright Python call this candidate becomes.
 *
 * Same decisions as `playwrightExpr`, different spelling: snake_case methods,
 * keyword arguments, `True`, and double quotes (Black's default).
 */
export function playwrightPyExpr(c: LocatorCandidate): string {
  const exact = (e: boolean | undefined) => (e ? ', exact=True' : '');
  switch (c.kind) {
    case 'testId':
      return `get_by_test_id(${qq(c.value)})`;
    case 'role':
      if (c.name === undefined) return `get_by_role(${qq(c.role)})`;
      return `get_by_role(${qq(c.role)}, name=${qq(c.name)}${exact(c.exact)})`;
    case 'label':
      return `get_by_label(${qq(c.text)}${exact(c.exact)})`;
    case 'placeholder':
      return `get_by_placeholder(${qq(c.text)}${exact(c.exact)})`;
    case 'text':
      return `get_by_text(${qq(c.text)}${exact(c.exact)})`;
    case 'altText':
      return `get_by_alt_text(${qq(c.text)}${exact(c.exact)})`;
    case 'title':
      return `get_by_title(${qq(c.text)}${exact(c.exact)})`;
    case 'css':
      return `locator(${qq(c.value)})`;
    case 'xpath':
      // See playwrightExpr: the prefix is not optional.
      return `locator(${qq(`xpath=${c.value}`)})`;
    default:
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
  if (frameworkId === 'playwright-python') return playwrightPyExpr(c);
  if (frameworkId.startsWith('playwright')) return playwrightExpr(c);
  return typeValue(c);
}
