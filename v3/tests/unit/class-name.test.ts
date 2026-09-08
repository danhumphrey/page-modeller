import { describe, it, expect } from 'vitest';
import { classNameFor } from '../../src/generators/class-name';

describe('classNameFor', () => {
  it('uses the last path segment', () => {
    expect(classNameFor('https://shop.example.com/shop/checkout')).toBe('CheckoutPage');
    expect(classNameFor('https://example.com/checkout/')).toBe('CheckoutPage');
  });

  it('drops a file extension', () => {
    expect(classNameFor('http://localhost:5199/login.html')).toBe('LoginPage');
  });

  it('joins a multi-word segment', () => {
    expect(classNameFor('https://example.com/order-confirmation')).toBe('OrderConfirmationPage');
  });

  it('falls back to the host at the root, without the TLD', () => {
    // The extension-strip earns its keep twice: login.html → Login, and
    // facebook.com → Facebook.
    expect(classNameFor('https://facebook.com/')).toBe('FacebookPage');
  });

  it('does not repeat Page when the path already says it', () => {
    expect(classNameFor('https://example.com/checkout-page')).toBe('CheckoutPage');
  });

  it('does not start an identifier with a digit', () => {
    expect(classNameFor('https://example.com/2fa')).toBe('Page2faPage');
  });

  it('falls back when there is no url or it is unparseable', () => {
    expect(classNameFor(null)).toBe('GeneratedPage');
    expect(classNameFor('not a url')).toBe('GeneratedPage');
  });
});
