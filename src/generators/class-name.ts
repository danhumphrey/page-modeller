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
    // The last meaningful path segment: /shop/checkout/ → checkout. Failing
    // that the host, so example.com becomes ExampleComPage rather than nothing.
    const segments = parsed.pathname.split('/').filter(Boolean);
    path = segments.at(-1) ?? parsed.hostname;
  } catch {
    return FALLBACK;
  }

  // Drop a file extension: checkout.html → checkout.
  const words = path
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return FALLBACK;

  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  // Identifiers cannot start with a digit.
  const safe = /^\d/.test(name) ? `Page${name}` : name;
  return safe.endsWith('Page') ? safe : `${safe}Page`;
}
