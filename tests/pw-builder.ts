import type { Page, Locator } from '@playwright/test';
import type { LocatorCandidate } from '../src/engine/types';

/** Resolve an IR candidate with Playwright's own engine — the ground-truth bridge. */
export function buildLocator(page: Page, c: LocatorCandidate): Locator {
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
    case 'linkText':
      // Selenium matches a link's rendered text, whitespace-normalised.
      return page.locator(`xpath=//a[normalize-space(.)=${xpathLiteral(c.text)}]`);
    case 'partialLinkText':
      return page.locator(`xpath=//a[contains(normalize-space(.), ${xpathLiteral(c.text)})]`);
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
