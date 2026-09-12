import type { Page, Locator } from '@playwright/test';
import type { LocatorCandidate } from '../src/engine/types';

/** A double-quoted string inside a Playwright selector. */
const pwQuoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Literal text as a regex, for `:text-matches`. */
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The same, but tolerant of the whitespace Selenium normalises away.
 *
 * `:text-is` normalises; `:text-matches` does not, so a literal regex built
 * from the normalised candidate text missed `<a>  Read   more  </a>` — which
 * is exactly the case `edgecases.html/ws-link` exists to catch.
 */
const looseWhitespace = (value: string) => escapeRegExp(value).replace(/ +/g, '\\s+');

/**
 * Resolve an IR candidate with Playwright's own engine — the ground-truth bridge.
 *
 * `page` is a Page or a Locator, because a shadow element's locator is scoped
 * by its host chain (SPEC §19) and the scoping is done by resolving the host
 * first and building the candidate against that. A Locator offers the same
 * getBy* surface, so nothing below changes.
 */
export function buildLocator(page: Page | Locator, c: LocatorCandidate): Locator {
  switch (c.kind) {
    case 'testId':
      return page.getByTestId(c.value);
    case 'role':
      return page.getByRole(
        c.role as Parameters<Page['getByRole']>[0],
        c.name !== undefined ? { name: c.name, exact: c.exact } : {}
      );
    case 'label':
      return page.getByLabel(c.text, { exact: c.exact });
    case 'placeholder':
      return page.getByPlaceholder(c.text, { exact: c.exact });
    case 'text':
      return page.getByText(c.text, { exact: c.exact });
    case 'altText':
      return page.getByAltText(c.text, { exact: c.exact });
    case 'title':
      return page.getByTitle(c.text, { exact: c.exact });
    case 'css':
      return page.locator(c.value);
    case 'xpath':
      return page.locator(`xpath=${c.value}`);

    // Selenium's By strategies, expressed as the CSS or XPath Playwright would
    // need — so the fidelity check covers our resolution of these too, not just
    // the Playwright-native kinds.
    case 'id':
      return page.locator(`#${cssEscape(c.value)}`);
    case 'name':
      return page.locator(`[name="${cssEscape(c.value)}"]`);
    case 'className':
      return page.locator(`.${cssEscape(c.value)}`);
    case 'tagName':
      return page.locator(c.value);
    // Selenium matches a link's rendered text, whitespace-normalised and
    // case-sensitively.
    //
    // Not XPath, which is how this was written: XPath cannot address a shadow
    // tree in any engine (SPEC §19), so a link inside a web component resolved
    // to nothing here while Selenium's LINK_TEXT finds it perfectly well — the
    // bridge was failing, not the candidate. Measured in shadow.probe.spec.ts.
    //
    // `:text-is` is exact and CASE-SENSITIVE, and `:text-matches` without
    // flags is a case-sensitive regex. `:has-text` would have been the obvious
    // choice for the partial form and is case-INSENSITIVE, which would have
    // made the ground truth disagree with Selenium on case.
    case 'linkText':
      return page.locator(`a:text-is(${pwQuoted(c.text)})`);
    case 'partialLinkText':
      return page.locator(`a:text-matches(${pwQuoted(looseWhitespace(c.text))})`);
  }
}

/** CSS.escape is a browser API; this is the subset needed for ids and classes. */
function cssEscape(value: string): string {
  return value.replace(/([^\w-])/g, '\\$1');
}

/** XPath has no escape character, so a string containing both quote types needs concat(). */
function xpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `concat('${value.split("'").join(`', "'", '`)}')`;
}
