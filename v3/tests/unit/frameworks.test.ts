import { describe, it, expect } from 'vitest';
import { frameworks, defaultFrameworkId, frameworkById } from '../../src/frameworks';

describe('frameworks', () => {
  it('defaults to Playwright TypeScript', () => {
    expect(frameworkById(defaultFrameworkId).label).toBe('Playwright (TypeScript)');
  });

  it('has unique ids', () => {
    const ids = frameworks.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers Selenium its native By strategies', () => {
    // linkText must be present and must NOT leak into Playwright (SPEC §3: the
    // framework is locked precisely because these lists differ).
    expect(frameworkById('selenium-java').locatorTypes).toContain('linkText');
    expect(frameworkById('playwright-ts').locatorTypes).not.toContain('linkText');
  });

  it('ranks testId first for Playwright', () => {
    expect(frameworkById('playwright-ts').locatorTypes[0]).toBe('testId');
  });

  it('gives every framework css and xpath as a floor', () => {
    for (const f of frameworks) {
      expect(f.locatorTypes, f.label).toEqual(expect.arrayContaining(['css', 'xpath']));
    }
  });

  it('falls back to the first framework for an unknown id', () => {
    expect(frameworkById('nope')).toBe(frameworks[0]);
  });
});
