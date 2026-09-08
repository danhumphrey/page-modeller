// Which descendants a scan collects (SPEC §4).
//
// Role-derived, not tagName: `<div role="button">` is a control and `<a>`
// without an href is not. The set is the four interactive buckets from the
// method mapping (SPEC §11) — actionable, text, toggle, select — so anything
// scan collects is something the generator knows how to write methods for.
// `static` is deliberately absent: a scan of a page would otherwise return
// every heading, paragraph and image on it. Those go in one at a time with Add.
import { ariaHidden, safeRole } from './candidates';

export const INTERACTIVE_ROLES: ReadonlySet<string> = new Set([
  // actionable
  'button',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'option',
  'treeitem',
  // text
  'textbox',
  'searchbox',
  'spinbutton',
  'slider',
  // toggle
  'checkbox',
  'radio',
  'switch',
  // select
  'combobox',
  'listbox',
]);

export function isInteractiveRole(role: string | null): boolean {
  return role != null && INTERACTIVE_ROLES.has(role);
}

/**
 * Form controls that HTML-AAM maps to NO role at all, so a role-only rule
 * misses them. `input[type=password]` is the one that matters: a scan of a
 * login form that skips the password field is plainly broken. The date and
 * time family, colour and file pickers are in the same position.
 *
 * `hidden` is excluded — it is never rendered and never interactive.
 */
const ROLELESS_INPUT_TYPES: ReadonlySet<string> = new Set([
  'password',
  'file',
  'color',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

function isRolelessControl(el: Element): boolean {
  return el.localName === 'input' && ROLELESS_INPUT_TYPES.has((el as HTMLInputElement).type);
}

/** Something a scan should collect: an interactive role, or a control with none. */
export function isInteractive(el: Element): boolean {
  return isInteractiveRole(safeRole(el)) || isRolelessControl(el);
}

/**
 * The interactive descendants of `root`, in document order.
 *
 * The root itself is never included — a scan models what is *inside* the
 * container you chose (SPEC §4).
 *
 * `includeHidden` is the `modelHiddenElements` setting. Off, elements excluded
 * from the accessibility tree are skipped, which is the same rule `getByRole`
 * applies, so a scan cannot collect something the generated locator could never
 * find. On, they are kept: a validation message or an unopened modal is real
 * page-object material, and Add cannot reach what is not rendered.
 */
export function collectInteractive(root: Element, includeHidden: boolean): Element[] {
  const found: Element[] = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (!isInteractive(el)) continue;
    if (!includeHidden && ariaHidden(el)) continue;
    found.push(el);
  }
  return found;
}
