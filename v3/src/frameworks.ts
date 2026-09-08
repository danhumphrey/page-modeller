// Target frameworks and the locator types each one can express (SPEC §7, §12).
//
// The type list is the FULL set the framework supports, not just the types the
// engine managed to generate for a given element: the Edit dialog offers all of
// them and leaves the value blank when there is no generated one. The generated
// set is a convenience, never a constraint.

/** Locator types are per-framework; the framework is locked once a model exists. */
export interface Framework {
  id: string;
  /** Shown in the toolbar selector and as the code dialog's title. */
  label: string;
  locatorTypes: readonly string[];
}

// Playwright's own ordering, testId first as the most change-resistant.
const PLAYWRIGHT_TYPES = ['testId', 'role', 'label', 'placeholder', 'text', 'altText', 'title', 'css', 'xpath'] as const;

// Selenium's native By strategies.
const SELENIUM_TYPES = ['id', 'linkText', 'partialLinkText', 'name', 'css', 'xpath', 'className', 'tagName'] as const;

export const frameworks: readonly Framework[] = [
  { id: 'playwright-ts', label: 'Playwright (TypeScript)', locatorTypes: PLAYWRIGHT_TYPES },
  { id: 'playwright-python', label: 'Playwright (Python)', locatorTypes: PLAYWRIGHT_TYPES },
  { id: 'selenium-java', label: 'Selenium WebDriver Java', locatorTypes: SELENIUM_TYPES },
  { id: 'selenium-csharp', label: 'Selenium WebDriver C#', locatorTypes: SELENIUM_TYPES },
  { id: 'selenium-python', label: 'Selenium WebDriver Python', locatorTypes: SELENIUM_TYPES },
  // Puppeteer has no user-facing locator API of its own.
  { id: 'puppeteer', label: 'Puppeteer', locatorTypes: ['css', 'xpath'] },
];

/** Playwright is the primary target going forward, so it is the default. */
export const defaultFrameworkId = 'playwright-ts';

export function frameworkById(id: string): Framework {
  return frameworks.find((f) => f.id === id) ?? frameworks[0];
}
