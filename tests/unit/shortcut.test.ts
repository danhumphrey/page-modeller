import { describe, it, expect } from 'vitest';
import { devtoolsShortcut } from '../../src/shortcut';

// F12 is not the answer everywhere, which is why this exists: on macOS it is
// bound to the system and most keyboards need `fn` as well, so a page telling
// a Mac user to press F12 tells them something that does not work.
describe('devtoolsShortcut', () => {
  it('uses Command + Option + I on macOS', () => {
    expect(devtoolsShortcut({ userAgentData: { platform: 'macOS' } })).toEqual(['Command', 'Option', 'I']);
  });

  it('uses Control + Shift + I elsewhere', () => {
    expect(devtoolsShortcut({ userAgentData: { platform: 'Windows' } })).toEqual(['Control', 'Shift', 'I']);
    expect(devtoolsShortcut({ userAgentData: { platform: 'Linux' } })).toEqual(['Control', 'Shift', 'I']);
  });

  it('falls back to navigator.platform where userAgentData is absent', () => {
    // Firefox does not implement userAgentData, so the deprecated reading is
    // the only one available there — and Firefox is half of what we ship to.
    expect(devtoolsShortcut({ platform: 'MacIntel' })).toEqual(['Command', 'Option', 'I']);
    expect(devtoolsShortcut({ platform: 'Win32' })).toEqual(['Control', 'Shift', 'I']);
  });

  it('assumes not-macOS when it can tell nothing', () => {
    // Ctrl+Shift+I is the safer guess: it is wrong on a Mac but harmless,
    // where Command+Option+I on Windows does nothing at all.
    expect(devtoolsShortcut({})).toEqual(['Control', 'Shift', 'I']);
  });
})
