import { describe, it, expect } from 'vitest';
import { playwrightTs, candidateExpr } from '../../src/generators/playwright-ts';
import { deriveName } from '../../src/engine/naming';
import type { PomModel } from '../../src/generators/types';
import type { ElementResult } from '../../src/engine/types';

describe('playwright-ts generator', () => {
  const model: PomModel = {
    className: 'LoginPage',
    url: 'https://example.com/login',
    elements: [
      { name: 'emailInput', candidate: { kind: 'role', role: 'textbox', name: 'Email address', exact: true } },
      { name: 'signInButton', candidate: { kind: 'role', role: 'button', name: 'Sign in', exact: true } },
      { name: 'saveButton', candidate: { kind: 'testId', value: 'save' } },
      { name: 'comment', candidate: { kind: 'placeholder', text: 'Leave a comment' } },
    ],
  };

  it('emits a valid Page Object class', () => {
    const code = playwrightTs.generate(model);
    expect(code).toContain(`import { type Page, type Locator } from '@playwright/test';`);
    expect(code).toContain(`export class LoginPage {`);
    expect(code).toContain(`readonly emailInput: Locator;`);
    expect(code).toContain(`this.emailInput = this.page.getByRole("textbox", { name: "Email address", exact: true });`);
    expect(code).toContain(`this.saveButton = this.page.getByTestId("save");`);
    expect(code).toContain(`await this.page.goto("https://example.com/login");`);
  });

  it('falls back to a safe class name', () => {
    const code = playwrightTs.generate({ className: '123 not valid', elements: [] });
    expect(code).toContain('export class GeneratedPage {');
  });

  it('escapes quotes in names', () => {
    expect(candidateExpr({ kind: 'role', role: 'button', name: 'Say "hi"', exact: true })).toBe(
      'getByRole("button", { name: "Say \\"hi\\"", exact: true })'
    );
  });

  it('maps every IR kind to an expression', () => {
    const kinds: Array<Parameters<typeof candidateExpr>[0]> = [
      { kind: 'label', text: 'Password', exact: true },
      { kind: 'text', text: 'Read more' },
      { kind: 'altText', text: 'Logo' },
      { kind: 'title', text: 'Help' },
      { kind: 'css', value: '#id' },
      { kind: 'xpath', value: '//button' },
    ];
    for (const k of kinds) expect(candidateExpr(k)).toMatch(/^(getBy|locator)/);
  });
});

describe('deriveName', () => {
  const mk = (role: string | null, accessibleName: string | null): ElementResult => ({
    tag: 'x',
    role,
    accessibleName,
    candidates: [],
    preferredIndex: -1,
  });

  it('derives readable, role-suffixed names', () => {
    const used = new Set<string>();
    expect(deriveName(mk('button', 'Sign in'), used)).toBe('signInButton');
    expect(deriveName(mk('textbox', 'Email address'), used)).toBe('emailAddressInput');
  });

  it('dedupes collisions', () => {
    const used = new Set<string>();
    expect(deriveName(mk('button', 'Continue'), used)).toBe('continueButton');
    expect(deriveName(mk('button', 'Continue'), used)).toBe('continueButton2');
  });

  it('falls back when no accessible name', () => {
    const used = new Set<string>();
    expect(deriveName(mk('link', ''), used)).toBe('link');
  });
});
