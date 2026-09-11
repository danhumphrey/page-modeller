// A name for the generated class (SPEC §17).
//
// Derived from the page the model was built on, because typing one is friction
// and `GeneratedPage` is nobody's idea of a class name. The user can rename it
// afterwards; being roughly right beats being blank.
const FALLBACK = 'GeneratedPage';

/** The override if there is one, otherwise derived from the URL. */
export function classNameOf(model: { url: string | null; className?: string }): string {
  return model.className?.trim() || classNameFor(model.url);
}

export function classNameFor(url: string | null): string {
  if (!url) return FALLBACK;

  let path: string;
  try {
    const parsed = new URL(url);
    // The last meaningful path segment: /shop/checkout/ → checkout.
    const segment = parsed.pathname.split('/').filter(Boolean).at(-1);
    path = segment
      ? // Drop a file extension: checkout.html → checkout.
        segment.replace(/\.[a-z0-9]+$/i, '')
      : // No path at all, so name it after the site. `www` is noise nobody
        // would put in a class name — the login page of www.facebook.com came
        // out as WwwFacebookPage — and the TLD is no better.
        parsed.hostname.replace(/^www\./i, '').replace(/\.[a-z0-9]+$/i, '');
  } catch {
    return FALLBACK;
  }

  const words = path.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return FALLBACK;

  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  // Identifiers cannot start with a digit.
  const safe = /^\d/.test(name) ? `Page${name}` : name;
  return safe.endsWith('Page') ? safe : `${safe}Page`;
}
