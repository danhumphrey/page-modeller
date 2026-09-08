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
