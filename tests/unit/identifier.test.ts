import { describe, it, expect } from 'vitest';
import { identifierError } from '../../src/identifier';
import { classNameOf } from '../../src/generators/class-name';

// The derived names are safe by construction; renaming and the class-name
// override are not, and neither was checked. The output is pasted into
// someone's test suite, so a name that cannot be an identifier is a file that
// does not compile — in four of the five languages. Python "survived" by
// silently mangling it, which is worse: one model, a working file in one
// language and a broken one in the rest.
describe('identifierError', () => {
  it('accepts what every target accepts', () => {
    for (const ok of ['SignIn', 'signIn', '_private', 'Field2', 'a']) {
      expect(identifierError(ok, 'Name'), ok).toBe('');
    }
  });

  it('refuses what no target accepts', () => {
    expect(identifierError('', 'Name')).toContain('required');
    expect(identifierError('My Page', 'Class name')).toContain('spaces');
    expect(identifierError('2fa', 'Name')).toContain('digit');
    expect(identifierError('Sign-In', 'Name')).toContain('letters');
    expect(identifierError('a;b()', 'Class name')).toContain('letters');
    // Valid in Java, C# and TypeScript, refused here on purpose: the name has
    // to work in all five at once, and a name nobody can type is a poor one.
    expect(identifierError('Größe', 'Name')).toContain('letters');
  });
});

describe('classNameOf refuses an unusable override', () => {
  it('falls back to the derived name rather than emitting one that cannot compile', () => {
    expect(classNameOf({ url: 'https://x.test/checkout', className: 'My Page' })).toBe('CheckoutPage');
    expect(classNameOf({ url: 'https://x.test/checkout', className: '9lives' })).toBe('CheckoutPage');
  });

  it('still honours a usable one', () => {
    expect(classNameOf({ url: 'https://x.test/checkout', className: 'LoginPage' })).toBe('LoginPage');
  });
});
