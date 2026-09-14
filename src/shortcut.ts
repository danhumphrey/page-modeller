/**
 * How to open DevTools, in words, for the platform this is running on.
 *
 * `F12` is not the answer everywhere, which is the whole reason this exists:
 * on macOS it is bound to the system by default and most keyboards need `fn`
 * as well, so a page telling a Mac user to press F12 is telling them something
 * that does not work. The combination that works on every desktop browser we
 * support is `Command + Option + I` on macOS and `Control + Shift + I`
 * elsewhere — F12 is an additional shortcut on Windows and Linux, not the only
 * one, so naming the modifier combination is correct in both places.
 *
 * `userAgentData.platform` is the supported reading and `navigator.platform`
 * the deprecated one, so the first is preferred and the second is the
 * fallback. Neither is available in a service worker, which is why this is
 * called from the page rather than passed in.
 *
 * Shared, because it was written twice — once for the Opera popup and once for
 * the what's new page — and two copies of a platform check drift.
 */
export function devtoolsShortcut(platform?: { userAgentData?: { platform?: string }; platform?: string }): string[] {
  const nav = platform ?? (navigator as { userAgentData?: { platform?: string }; platform?: string });
  const hint = nav.userAgentData?.platform;
  const mac = hint ? hint === 'macOS' : /Mac/i.test(nav.platform ?? '');
  return mac ? ['Command', 'Option', 'I'] : ['Control', 'Shift', 'I'];
}
