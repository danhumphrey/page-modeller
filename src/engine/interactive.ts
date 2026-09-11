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
export function collectInteractive(root: Element | ShadowRoot, includeHidden: boolean): Element[] {
  const found: Element[] = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (isInteractive(el) && (includeHidden || !ariaHidden(el))) found.push(el);
    // A web component's controls live in its shadow root, which
    // querySelectorAll does not enter (SPEC §19). Etsy's sign-up form is
    // <clg-text-input> elements whose real <input> is inside one, so a scan of
    // the dialog returned the buttons around the form and none of the form.
    //
    // Open roots only: `shadowRoot` is null for a closed one and there is no
    // way in from script. `collectClosedHosts` reports those separately, so a
    // scan says what it could not read rather than quietly returning less.
    if (el.shadowRoot) found.push(...collectInteractive(el.shadowRoot, includeHidden));
  }
  return found;
}

/**
 * A custom element rendering content that no tree walk can reach.
 *
 * A closed root cannot be detected directly — `shadowRoot` is null exactly as
 * it is for an element with no root at all — so this asks whether the element
 * DRAWS something it has no light DOM to explain. A defined custom element
 * with no children, no text and a real box on screen is rendering from a
 * closed root; there is nowhere else for it to come from.
 *
 * Deliberately conservative. A false positive warns about an element that is
 * fine, and a warning that fires on every inert custom element stops being
 * read — so a behaviour-only component, which is common, must not trip it.
 * A closed root that is itself hidden goes unreported, which costs nothing:
 * there was nothing to collect from it either way.
 */
function isClosedHost(el: Element): boolean {
  if (!el.localName.includes('-')) return false;
  if (el.childElementCount > 0 || el.textContent?.trim()) return false;
  try {
    if (!el.ownerDocument.defaultView?.customElements.get(el.localName)) return false;
  } catch {
    return false;
  }
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/**
 * Hosts inside `root` whose shadow root is closed, so a scan can say what it
 * could not read (SPEC §19). Silence is indistinguishable from a bug, which is
 * how the whole shadow DOM gap was first reported.
 *
 * A closed root is detectable even though it is not readable: the element is a
 * custom element that renders content no tree walk can reach. `shadowRoot`
 * being null is not enough on its own — most elements have no shadow root at
 * all — so this asks the element whether it has one the only way available,
 * which is to look for a registered custom element whose rendering cannot be
 * accounted for by its light DOM.
 */
export function collectClosedHosts(root: Element | ShadowRoot): Element[] {
  const out: Element[] = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.shadowRoot) {
      out.push(...collectClosedHosts(el.shadowRoot));
    } else if (isClosedHost(el)) {
      out.push(el);
    }
  }
  return out;
}
