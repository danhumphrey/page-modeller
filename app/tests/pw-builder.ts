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
      return page.getByPlaceholder(c.text);
    case 'text':
      return page.getByText(c.text, { exact: c.exact });
    case 'altText':
      return page.getByAltText(c.text);
    case 'title':
      return page.getByTitle(c.text);
    case 'css':
      return page.locator(c.value);
    case 'xpath':
      return page.locator(`xpath=${c.value}`);
  }
}
