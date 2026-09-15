import { describe, it, expect } from 'vitest';
import { matchesText } from '../../src/engine/candidates';

// Playwright's semantics, which the eye (SPEC §8) has to reproduce or the count
// it shows will differ from the count the generated test gets. Verified against
// real Playwright by tests/engine.fidelity.spec.ts; these pin the intent.
describe('matchesText', () => {
  describe('exact: true — case-sensitive, whole-string', () => {
    it('matches the whole string', () => {
      expect(matchesText('Sign in', 'Sign in', true)).toBe(true);
    });
    it('rejects a substring', () => {
      expect(matchesText('Sign in now', 'Sign in', true)).toBe(false);
    });
    it('is case-sensitive', () => {
      expect(matchesText('Sign In', 'Sign in', true)).toBe(false);
    });
    it('still trims whitespace', () => {
      // "Note that exact match still trims whitespace."
      expect(matchesText('  Sign in  ', 'Sign in', true)).toBe(true);
    });
  });

  describe('exact: false — case-insensitive, substring (Playwright default)', () => {
    it('matches a substring', () => {
      expect(matchesText('Sign in now', 'Sign in', false)).toBe(true);
    });
    it('ignores case', () => {
      expect(matchesText('SIGN IN', 'sign in', false)).toBe(true);
    });
    it('rejects text that does not contain it', () => {
      expect(matchesText('Register', 'Sign in', false)).toBe(false);
    });
    it('is the behaviour when exact is undefined', () => {
      expect(matchesText('Sign in now', 'Sign in', undefined)).toBe(true);
    });
  });

  it('normalises whitespace in both modes', () => {
    // Matching by text collapses runs and turns line breaks into spaces.
    expect(matchesText('Sign\n  in', 'Sign in', true)).toBe(true);
    expect(matchesText('Sign\tin now', 'sign in', false)).toBe(true);
  });
});
