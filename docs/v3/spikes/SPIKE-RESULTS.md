# Spike #1 Results — A11y Locator Fidelity vs Real Playwright

**Core result:** 43/43 elements got a preferred locator that resolved **uniquely to the correct element** in a real Playwright run.

**Semantic coverage:** 35/43 elements were satisfied by a *semantic* locator (getByRole/getByLabel/getByText/etc.) rather than falling back to CSS/XPath.

## Preferred locator per element

| Fixture | Element | Preferred locator | Resolves uniquely to target |
|---|---|---|---|
| login.html | `nav-home` | `getByRole('link', { name: 'Home', exact: true })` | ✅ |
| login.html | `nav-about` | `getByRole('link', { name: 'About', exact: true })` | ✅ |
| login.html | `page-heading` | `getByRole('heading', { name: 'Sign in to your account', exact: true })` | ✅ |
| login.html | `email-input` | `getByRole('textbox', { name: 'Email address', exact: true })` | ✅ |
| login.html | `password-input` | `getByLabel('Password', { exact: true })` | ✅ |
| login.html | `remember-checkbox` | `getByRole('checkbox', { name: 'Remember me', exact: true })` | ✅ |
| login.html | `submit-button` | `getByRole('button', { name: 'Sign in', exact: true })` | ✅ |
| login.html | `forgot-link` | `getByRole('link', { name: 'Forgot your password?', exact: true })` | ✅ |
| login.html | `icon-close` | `getByRole('button', { name: 'Close dialog', exact: true })` | ✅ |
| login.html | `logo-img` | `getByRole('img', { name: 'Acme Corporation logo', exact: true })` | ✅ |
| widgets.html | `section-heading` | `getByRole('heading', { name: 'Account settings', exact: true })` | ✅ |
| widgets.html | `testid-button` | `getByTestId('save-settings')` | ✅ |
| widgets.html | `country-select` | `getByRole('combobox', { name: 'Country', exact: true })` | ✅ |
| widgets.html | `aria-label-input` | `getByRole('textbox', { name: 'Search products', exact: true })` | ✅ |
| widgets.html | `comment-textarea` | `getByPlaceholder('Leave a comment')` | ✅ |
| widgets.html | `title-link` | `getByRole('link', { name: '?', exact: true })` | ✅ |
| widgets.html | `alert-region` | `getByRole('alert')` | ✅ |
| widgets.html | `radio-pro` | `getByRole('radio', { name: 'Pro plan', exact: true })` | ✅ |
| widgets.html | `unique-paragraph` | `getByText('This is a unique descriptive paragraph of text.', { exact: true })` | ✅ |
| ambiguous.html | `add-a` | `locator('body > main > section:nth-of-type(1) > button')` | ✅ |
| ambiguous.html | `add-b` | `locator('body > main > section:nth-of-type(2) > button')` | ✅ |
| ambiguous.html | `details-a` | `locator('body > main > a:nth-of-type(1)')` | ✅ |
| ambiguous.html | `details-b` | `locator('body > main > a:nth-of-type(2)')` | ✅ |
| ambiguous.html | `checkout-btn` | `locator('#checkout')` | ✅ |
| edgecases.html | `aria-label-btn` | `getByRole('button', { name: 'Save document', exact: true })` | ✅ |
| edgecases.html | `labelledby-input` | `getByRole('textbox', { name: 'First name', exact: true })` | ✅ |
| edgecases.html | `title-only-input` | `getByRole('textbox', { name: 'Phone number', exact: true })` | ✅ |
| edgecases.html | `placeholder-only-input` | `getByPlaceholder('Enter city')` | ✅ |
| edgecases.html | `empty-alt-img` | `getByRole('presentation')` | ✅ |
| edgecases.html | `svg-img` | `getByRole('img', { name: 'Search', exact: true })` | ✅ |
| edgecases.html | `div-button` | `getByRole('button', { name: 'Click me', exact: true })` | ✅ |
| edgecases.html | `nested-heading` | `getByRole('heading', { name: 'Hello World', exact: true })` | ✅ |
| edgecases.html | `ws-link` | `getByRole('link', { name: 'Read more', exact: true })` | ✅ |
| edgecases.html | `css-before-btn` | `getByRole('button', { name: 'Download file', exact: true })` | ✅ |
| edgecases.html | `hidden-display-btn` | `getByText('Hidden action', { exact: true })` | ✅ |
| edgecases.html | `aria-hidden-btn` | `getByText('Ghost action', { exact: true })` | ✅ |
| edgecases.html | `visibility-hidden-input` | `locator('body > main > input:nth-of-type(4)')` | ✅ |
| edgecases.html | `submit-value-input` | `getByRole('button', { name: 'Send form', exact: true })` | ✅ |
| edgecases.html | `fieldset-group` | `getByRole('group', { name: 'Billing details', exact: true })` | ✅ |
| edgecases.html | `link-arialabel-overrides` | `getByRole('link', { name: 'Go to homepage', exact: true })` | ✅ |
| edgecases.html | `vh-labelledby-btn` | `getByRole('button', { name: 'Toggle navigation menu', exact: true })` | ✅ |
| edgecases.html | `dup-name-a` | `locator('body > main > button:nth-of-type(6)')` | ✅ |
| edgecases.html | `dup-name-b` | `locator('body > main > button:nth-of-type(7)')` | ✅ |

## Per-strategy fidelity (where our engine predicted a unique match)

| Strategy | Samples | Predicted-unique | Playwright agreed (count=1) | Landed on target |
|---|---|---|---|---|
| role | 41 | 29 | 29 | 29 |
| text | 27 | 18 | 18 | 18 |
| css | 43 | 43 | 43 | 43 |
| xpath | 43 | 42 | 42 | 42 |
| label | 6 | 6 | 6 | 6 |
| placeholder | 4 | 4 | 4 | 4 |
| altText | 1 | 1 | 1 | 1 |
| testId | 1 | 1 | 1 | 1 |
| title | 2 | 2 | 2 | 2 |

## Preferred-locator failures (core contract)

_None — every element yielded a unique preferred locator that resolved to the correct element._

## Divergences: `dom-accessibility-api` vs Playwright (predicted unique, but Playwright disagreed)

_These are the cases where our computed role/name produced a semantic locator we thought unique, but Playwright's own engine resolved a different count. This is the data for the §14 vendor-or-not decision._

_None — every locator our engine deemed unique resolved uniquely to the correct element in Playwright._
