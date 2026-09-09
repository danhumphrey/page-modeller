// One model builder for every generator test.
import { emptyModel, type ModelElement, type TabModel } from '../../../src/model';
import type { LocatorCandidate } from '../../../src/engine/types';

export type TestElement = Partial<ModelElement> & { name: string; candidate: LocatorCandidate };

export function modelOf(frameworkId: string, ...elements: TestElement[]): TabModel {
  const m = emptyModel(frameworkId);
  m.url = 'https://example.com/account/login.html';
  m.elements = elements.map(({ candidate, ...el }, i) => ({
    id: `el-${i}`,
    tag: 'div',
    role: null,
    accessibleName: null,
    suggestedName: el.name,
    selectedIndex: 0,
    preferredIndex: 0,
    candidates: [{ candidate, predictedCount: 1 }],
    framePath: [],
    ...el,
  })) as ModelElement[];
  return m;
}

export const EMAIL: TestElement = {
  name: 'EmailAddress',
  role: 'textbox',
  tag: 'input',
  candidate: { kind: 'name', value: 'email' },
};
export const SIGN_IN: TestElement = {
  name: 'SignIn',
  role: 'button',
  tag: 'button',
  candidate: { kind: 'id', value: 'go' },
};
export const COUNTRY: TestElement = {
  name: 'Country',
  role: 'combobox',
  tag: 'select',
  candidate: { kind: 'id', value: 'c' },
};
export const TOPPINGS: TestElement = {
  name: 'Toppings',
  role: 'listbox',
  tag: 'select',
  candidate: { kind: 'id', value: 't' },
};
export const REMEMBER: TestElement = {
  name: 'RememberMe',
  role: 'checkbox',
  tag: 'input',
  candidate: { kind: 'id', value: 'r' },
};
export const LOGO: TestElement = { name: 'Logo', role: 'img', tag: 'img', candidate: { kind: 'id', value: 'l' } };
export const HEADING: TestElement = {
  name: 'Welcome',
  role: 'heading',
  tag: 'h1',
  candidate: { kind: 'css', value: 'h1' },
};

// Playwright and Puppeteer cannot express `name` or `id` (SPEC §7), so a model
// built from the Selenium fixtures above renders as garbage under them. Ask for
// the right ones rather than remembering to.
export const PW_EMAIL: TestElement = {
  name: 'EmailAddress',
  role: 'textbox',
  tag: 'input',
  candidate: { kind: 'label', text: 'Email address', exact: true },
};
export const PW_SIGN_IN: TestElement = {
  name: 'SignIn',
  role: 'button',
  tag: 'button',
  candidate: { kind: 'role', role: 'button', name: 'Sign in', exact: true },
};
export const CSS_ROW: TestElement = {
  name: 'FirstRow',
  role: null,
  tag: 'div',
  candidate: { kind: 'css', value: 'div.row' },
};

/** Elements the given framework can actually express. */
export function elementsFor(frameworkId: string): TestElement[] {
  if (frameworkId.startsWith('playwright')) return [PW_EMAIL, PW_SIGN_IN, HEADING];
  if (frameworkId === 'puppeteer') return [CSS_ROW, HEADING];
  return [EMAIL, SIGN_IN, HEADING];
}

/**
 * One element per locator type a framework offers — so a compile or parse check
 * covers the whole surface, not whichever three types the sample happened to
 * use. `frameworks.test.ts` asserts these lists stay complete.
 */
export const PW_ALL: TestElement[] = [
  { name: 'ByTestId', role: 'button', tag: 'button', candidate: { kind: 'testId', value: 'submit' } },
  { name: 'ByRole', role: 'button', tag: 'button', candidate: { kind: 'role', role: 'button', name: 'Sign in', exact: true } },
  { name: 'ByLabel', role: 'textbox', tag: 'input', candidate: { kind: 'label', text: 'Email address', exact: true } },
  { name: 'ByPlaceholder', role: 'textbox', tag: 'input', candidate: { kind: 'placeholder', text: 'Comment', exact: true } },
  { name: 'ByText', role: null, tag: 'p', candidate: { kind: 'text', text: 'Create new account', exact: true } },
  { name: 'ByAltText', role: 'img', tag: 'img', candidate: { kind: 'altText', text: 'Acme logo', exact: true } },
  { name: 'ByTitle', role: 'link', tag: 'a', candidate: { kind: 'title', text: 'Open help', exact: true } },
  { name: 'ByCss', role: null, tag: 'div', candidate: { kind: 'css', value: 'div.row' } },
  { name: 'ByXpath', role: null, tag: 'div', candidate: { kind: 'xpath', value: '/html[1]/body[1]/div[2]' } },
];

export const PUPPETEER_ALL: TestElement[] = [
  { name: 'ByCss', role: null, tag: 'div', candidate: { kind: 'css', value: 'a[href="/x"]' } },
  { name: 'ByXpath', role: null, tag: 'div', candidate: { kind: 'xpath', value: '/html[1]/body[1]/div[2]' } },
];

export const SELENIUM_ALL: TestElement[] = [
  { name: 'ById', role: 'button', tag: 'button', candidate: { kind: 'id', value: 'go' } },
  { name: 'ByName', role: 'textbox', tag: 'input', candidate: { kind: 'name', value: 'email' } },
  { name: 'ByClassName', role: null, tag: 'div', candidate: { kind: 'className', value: 'row' } },
  { name: 'ByTagName', role: null, tag: 'h1', candidate: { kind: 'tagName', value: 'h1' } },
  { name: 'ByLinkText', role: 'link', tag: 'a', candidate: { kind: 'linkText', text: 'Create new account' } },
  { name: 'ByPartialLinkText', role: 'link', tag: 'a', candidate: { kind: 'partialLinkText', text: 'Create' } },
  { name: 'ByCss', role: null, tag: 'div', candidate: { kind: 'css', value: 'div.row' } },
  { name: 'ByXpath', role: null, tag: 'div', candidate: { kind: 'xpath', value: '/html[1]/body[1]/div[2]' } },
];

/** Every locator type the framework offers, one element each. */
export function everyTypeFor(frameworkId: string): TestElement[] {
  if (frameworkId.startsWith('playwright')) return PW_ALL;
  if (frameworkId === 'puppeteer') return PUPPETEER_ALL;
  return SELENIUM_ALL;
}

/**
 * One element per method bucket, every candidate a `css` one so the same list
 * is expressible in every framework. Buckets decide which methods get emitted;
 * `everyTypeFor` decides which locator calls appear inside them.
 */
export const ALL_BUCKETS: TestElement[] = [
  { name: 'ActionableEl', role: 'button', tag: 'button', candidate: { kind: 'css', value: 'button.pay' } },
  { name: 'TextEl', role: 'textbox', tag: 'input', candidate: { kind: 'css', value: 'input.email' } },
  { name: 'ToggleEl', role: 'checkbox', tag: 'input', candidate: { kind: 'css', value: 'input.remember' } },
  { name: 'RadioEl', role: 'radio', tag: 'input', candidate: { kind: 'css', value: 'input.plan' } },
  { name: 'SelectEl', role: 'combobox', tag: 'select', candidate: { kind: 'css', value: 'select.country' } },
  { name: 'MultiSelectEl', role: 'listbox', tag: 'select', candidate: { kind: 'css', value: 'select.toppings' } },
  { name: 'StaticEl', role: 'heading', tag: 'h1', candidate: { kind: 'css', value: 'h1' } },
  { name: 'ImageEl', role: 'img', tag: 'img', candidate: { kind: 'css', value: 'img.logo' } },
  { name: 'PasswordEl', role: null, tag: 'input', inputType: 'password', candidate: { kind: 'css', value: 'input.pass' } },
];
