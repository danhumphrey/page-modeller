import type { ElementResult } from './types';

// Map common roles to a readable noun suffix for nicer property names.
const ROLE_SUFFIX: Record<string, string> = {
  button: 'Button',
  link: 'Link',
  textbox: 'Input',
  checkbox: 'Checkbox',
  radio: 'Radio',
  combobox: 'Select',
  heading: 'Heading',
  tab: 'Tab',
  menuitem: 'MenuItem',
};

function camelCase(input: string): string {
  const words = input
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
    .slice(0, 40);
}

/**
 * Derive a unique, readable property name for a picked element from its
 * accessible name (preferred) plus a role-based suffix, falling back to role
 * or tag. `used` is mutated to reserve the returned name.
 */
export function deriveName(el: ElementResult, used: Set<string>): string {
  const base = el.accessibleName || '';
  let name = camelCase(base);
  const suffix = el.role ? ROLE_SUFFIX[el.role] : undefined;
  if (suffix && name && !name.toLowerCase().endsWith(suffix.toLowerCase())) {
    name += suffix;
  }
  if (!name) name = camelCase(el.role || el.tag) || 'element';
  if (/^\d/.test(name)) name = `el${name[0].toUpperCase()}${name.slice(1)}`;

  let candidate = name;
  let n = 2;
  while (used.has(candidate)) candidate = `${name}${n++}`;
  used.add(candidate);
  return candidate;
}
