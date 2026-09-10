// Applying the theme preference (SPEC §14).
//
// Two things have to move together, which is why this is shared rather than
// written out in each surface: our CSS tokens, stamped on the root, and
// Quasar's own dark mode, which paints its dialogs, notifications and the body
// background. Setting only the first gives dark text on Quasar's dark ground.
import type { QVueGlobals } from 'quasar';
import type { ThemePreference } from '@/src/settings';

export function applyTheme(quasar: QVueGlobals, theme: ThemePreference): void {
  const root = document.documentElement;
  // Absent means "system", which the CSS resolves through prefers-color-scheme.
  if (theme === 'system') root.removeAttribute('data-pm-theme');
  else root.setAttribute('data-pm-theme', theme);

  quasar.dark.set(theme === 'system' ? 'auto' : theme === 'dark');
}
