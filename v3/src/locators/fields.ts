// What the Edit dialog has to ask for, per locator type (SPEC §9, §12).
//
// A locator is a type plus the fields that type needs — `getByRole` takes a
// role AND a name, so the dialog cannot be a single value box. Everything else
// happens to need one field, but the shape is what makes role expressible.
import type { LocatorCandidate } from '../engine/types';

export type LocatorKind = LocatorCandidate['kind'];

export interface LocatorField {
  /** Key in the built candidate. */
  key: string;
  label: string;
  /**
   * Blank is meaningful for this field. Only `getByRole`'s name qualifies —
   * `getByRole('navigation')` is a real locator. Everywhere else an empty value
   * makes a locator that matches whatever happens to have nothing there: an
   * empty `label` matches every control with no accessible name.
   */
  optional?: boolean;
}

const ONE = (key: string, label: string): LocatorField[] => [{ key, label }];

const FIELDS: Record<LocatorKind, LocatorField[]> = {
  testId: ONE('value', 'Test ID'),
  role: [
    { key: 'role', label: 'Role' },
    { key: 'name', label: 'Accessible name', optional: true },
  ],
  label: ONE('text', 'Label'),
  placeholder: ONE('text', 'Placeholder'),
  text: ONE('text', 'Text'),
  altText: ONE('text', 'Alt text'),
  title: ONE('text', 'Title'),
  css: ONE('value', 'CSS selector'),
  xpath: ONE('value', 'XPath'),
  id: ONE('value', 'ID'),
  name: ONE('value', 'Name'),
  className: ONE('value', 'Class name'),
  tagName: ONE('value', 'Tag name'),
  linkText: ONE('text', 'Link text'),
  partialLinkText: ONE('text', 'Partial link text'),
};

/** True when every field the type needs has a value. */
export function isComplete(kind: LocatorKind, values: Record<string, string>): boolean {
  return fieldsFor(kind).every((f) => f.optional || (values[f.key] ?? '').trim() !== '');
}

export function fieldsFor(kind: LocatorKind): LocatorField[] {
  return FIELDS[kind] ?? ONE('value', 'Value');
}

/** Pull a candidate apart into editable values. */
export function valuesOf(c: LocatorCandidate): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fieldsFor(c.kind)) values[f.key] = String((c as unknown as Record<string, unknown>)[f.key] ?? '');
  return values;
}

/**
 * Put one back together. Generated candidates always carry `exact: true`
 * (SPEC §12), and a hand-edited one keeps that — the dialog does not expose
 * `exact`, so silently dropping it would loosen the locator behind the user's
 * back.
 */
export function buildCandidate(kind: LocatorKind, values: Record<string, string>): LocatorCandidate {
  const built: Record<string, unknown> = { kind };
  for (const f of fieldsFor(kind)) built[f.key] = values[f.key] ?? '';
  if (kind === 'role') {
    if (!built.name) delete built.name;
    built.exact = true;
  } else if (['label', 'placeholder', 'text', 'altText', 'title'].includes(kind)) {
    built.exact = true;
  }
  return built as unknown as LocatorCandidate;
}
