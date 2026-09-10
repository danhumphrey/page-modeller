// Which methods an element gets (SPEC §11).
//
// Keyed on the computed a11y role, never on tagName. v2.5.1 keyed on tags, so
// `<div role="button">` — ubiquitous now — got no click() at all and fell
// through to getText().
import type { ModelElement } from '../model';

export type Bucket = 'actionable' | 'text' | 'toggle' | 'radio' | 'select' | 'multiSelect' | 'static';

const ACTIONABLE = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'option', 'treeitem']);
const TEXT = new Set(['textbox', 'searchbox', 'spinbutton', 'slider']);
const TOGGLE = new Set(['checkbox', 'switch']);

/**
 * `input[type=password]` and friends have no ARIA role at all, so a role-only
 * classifier would call them static and generate a getText() for a field you
 * type into. Scan already has to know this (SPEC §4); so does the generator.
 */
const ROLELESS_TEXT_INPUTS = new Set(['password', 'email', 'tel', 'url', 'search', 'number', 'date', 'datetime-local', 'month', 'time', 'week']);

export function classify(el: Pick<ModelElement, 'role' | 'tag'> & { inputType?: string }): Bucket {
  const { role, tag } = el;

  if (role === 'radio') return 'radio';
  if (role && TOGGLE.has(role)) return 'toggle';
  if (role && ACTIONABLE.has(role)) return 'actionable';
  if (role && TEXT.has(role)) return 'text';

  // Selenium's Select and Playwright's selectOption both require a real
  // <select>; `new Select(div)` throws UnexpectedTagNameException. A custom
  // combobox built from divs is something you click open instead (SPEC §11).
  if (role === 'combobox') return tag === 'select' ? 'select' : 'actionable';
  if (role === 'listbox') return tag === 'select' ? 'multiSelect' : 'actionable';

  if (tag === 'input' && el.inputType && ROLELESS_TEXT_INPUTS.has(el.inputType)) return 'text';
  if (tag === 'input' && (el.inputType === 'file' || el.inputType === 'color')) return 'text';

  return 'static';
}

/** Static elements are read for assertions; an image has no text, only alt. */
export function isImage(el: Pick<ModelElement, 'role' | 'tag'>): boolean {
  return el.role === 'img' || el.tag === 'img';
}
