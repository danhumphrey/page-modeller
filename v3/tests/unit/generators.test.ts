import { describe, it, expect } from 'vitest';
import { canGenerate, generateCode, shapesFor } from '../../src/generators';
import { frameworks } from '../../src/frameworks';
import { modelOf, EMAIL, SIGN_IN } from './fixtures/model';

describe('the generator registry', () => {
  it('covers every framework the toolbar offers', () => {
    // A framework in the selector that generates nothing is worse than one
    // that is not offered at all.
    for (const f of frameworks) {
      expect(canGenerate(f.id), f.label).toBe(true);
      expect(generateCode(modelOf(f.id, EMAIL, SIGN_IN)), f.label).not.toBe('');
    }
  });

  it('offers Locators only everywhere, under the same id', () => {
    for (const f of frameworks) {
      expect(shapesFor(f.id).map((s) => s.id), f.label).toContain('locators');
    }
  });

  it('defaults to the first shape, and falls back to it for an unknown one', () => {
    const model = modelOf('selenium-java', SIGN_IN);
    const methods = generateCode(model, 'methods');
    expect(generateCode(model)).toBe(methods);
    expect(generateCode(model, 'no-such-shape')).toBe(methods);
    expect(generateCode(model, 'locators')).not.toBe(methods);
  });

  it('says which target is missing rather than showing nothing', () => {
    // Unreachable while the test above passes — but a framework added to the
    // list without a generator should say so, not render blank.
    const model = modelOf('selenium-java', SIGN_IN);
    model.frameworkId = 'not-a-framework';
    expect(generateCode(model)).toContain('is not generated yet');
  });
});
