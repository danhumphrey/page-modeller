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

// Selenium's native By strategies, in order of preference.
//
// `name` ahead of `id`, unlike v2.5.1. A name is author-chosen and essentially
// never framework-generated, while ids are generated constantly — React's useId
// gave Facebook's password field `id="_r_6_"` alongside `name="pass"`.
//
// It is not only form controls: `<a>`, `<iframe>`, `<map>` and `<object>` carry
// a name too. That is fine — wherever it exists it was written by hand, which
// is the whole point. A legacy `<a name="top">` is usually an anchor target
// with no text, so it has no linkText to lose to.
//
// Safe even for a radio group, whose members share a name: a candidate is only
// chosen when it resolves uniquely (SPEC §7).
const SELENIUM_TYPES = ['name', 'id', 'linkText', 'partialLinkText', 'css', 'xpath', 'className', 'tagName'] as const;

// Puppeteer: css and xpath only.
//
// Its P-selectors looked like they would buy role and text parity, and
// `tests/puppeteer.fidelity.spec.ts` says they cannot:
//
//   - `::-p-text` is SUBSTRING matching with no exact variant, so
//     `::-p-text("Sign in")` also matched the heading "Sign in to your
//     account". SPEC §12 emits `exact: true` precisely to stop that.
//   - `::-p-aria([role=…])` wants Chrome's AX role names, not ARIA's — `img`
//     is `image` there — and `role="presentation"` is not in the tree at all.
//   - `::-p-aria([name=…])` compares exactly against Chrome's own name string,
//     which keeps whitespace we normalise away: `<a>  Read   more  </a>` is
//     named `"Read more "`, trailing space included. Unpredictable from here.
//
// What actually closes the gap is a better css candidate — see cssFor.
const PUPPETEER_TYPES = ['css', 'xpath'] as const;

export const frameworks: readonly Framework[] = [
  { id: 'playwright-ts', label: 'Playwright (TypeScript)', locatorTypes: PLAYWRIGHT_TYPES },
  { id: 'playwright-python', label: 'Playwright (Python)', locatorTypes: PLAYWRIGHT_TYPES },
  { id: 'selenium-java', label: 'Selenium WebDriver Java', locatorTypes: SELENIUM_TYPES },
  { id: 'selenium-csharp', label: 'Selenium WebDriver C#', locatorTypes: SELENIUM_TYPES },
  { id: 'selenium-python', label: 'Selenium WebDriver Python', locatorTypes: SELENIUM_TYPES },
  { id: 'puppeteer', label: 'Puppeteer', locatorTypes: PUPPETEER_TYPES },
];

/** Playwright is the primary target going forward, so it is the default. */
export const defaultFrameworkId = 'playwright-ts';

export function frameworkById(id: string): Framework {
  return frameworks.find((f) => f.id === id) ?? frameworks[0];
}
