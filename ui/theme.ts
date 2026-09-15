// Applying the theme preference (SPEC §14).
//
// Two things have to move together, which is why this is shared rather than
// written out in each surface: our CSS tokens, stamped on the root, and
// Quasar's own dark mode, which paints its dialogs, notifications and the body
// background. Setting only the first gives dark text on Quasar's dark ground.
import type { QVueGlobals } from 'quasar';
import type { ThemePreference } from '@/src/settings';

/**
 * `hostTheme` is what the surface says "system" resolves to, where it knows —
 * DevTools' own theme for a DevTools panel (SPEC §14). Undefined leaves the
 * question to `prefers-color-scheme`, which is right for the side panel and
 * the sidebar, and for the options page.
 */
export function applyTheme(
  quasar: QVueGlobals,
  theme: ThemePreference,
  hostTheme?: 'dark' | 'light'
): void {
  const root = document.documentElement;
  const resolved = theme === 'system' ? hostTheme : theme;
  // Absent means "system with nobody to ask", which the CSS resolves through
  // prefers-color-scheme.
  if (resolved) root.setAttribute('data-pm-theme', resolved);
  else root.removeAttribute('data-pm-theme');

  quasar.dark.set(resolved ? resolved === 'dark' : 'auto');
}
