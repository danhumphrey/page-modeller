// Which methods an element gets (SPEC §11).
//
// Keyed on the computed a11y role, never on tagName. v2.5.1 keyed on tags, so
// `<div role="button">` — ubiquitous now — got no click() at all and fell
// through to getText().
import type { ModelElement } from '../model';

export type Bucket = 'actionable' | 'text' | 'toggle' | 'radio' | 'select' | 'multiSelect' | 'slider' | 'static';

const ACTIONABLE = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'option', 'treeitem']);
const TEXT = new Set(['textbox', 'searchbox', 'spinbutton']);
const TOGGLE = new Set(['checkbox', 'switch']);

/**
 * `input[type=password]` and friends have no ARIA role at all, so a role-only
 * classifier would call them static and generate a getText() for a field you
 * type into. Scan already has to know this (SPEC §4); so does the generator.
 */
const ROLELESS_TEXT_INPUTS = new Set(['password', 'email', 'tel', 'url', 'search', 'number', 'date', 'datetime-local', 'month', 'time', 'week']);

export function classify(el: Pick<ModelElement, 'role' | 'tag'> & { inputType?: string }): Bucket {
  const { role, tag } = el;

  // Not text, though it carries a value. Selenium's text setter would call
  // clear() on it, which moves a range to the MIDDLE of its span and reports
  // nothing, then send_keys, which does nothing at all — measured, not assumed.
  if (role === 'slider') return 'slider';
  // Toggle and radio methods are built on WebDriver's isSelected(), which is
  // defined only for input[type=checkbox|radio] and <option> — for anything
  // else it returns false, always. `role="switch"` has no native element at
  // all, so it was wrong 100% of the time: isDarkModeChecked() said false for
  // a switch that was on, and setDarkMode(true) clicked an already-on switch
  // and turned it OFF.
  //
  // Same rule as <select> above and <option> below: the role decides what the
  // element IS, the tag decides whether the helper can drive it. A custom
  // toggle is clicked, which is always correct.
  const nativeInput = (type: string) => tag === 'input' && el.inputType === type;
  if (role === 'radio') return nativeInput('radio') ? 'radio' : 'actionable';
  if (role && TOGGLE.has(role)) return nativeInput('checkbox') ? 'toggle' : 'actionable';
  // A native <option> is reached through its <select>, never clicked — which
  // is what Selenium's Select exists for, and what `selectOption` does in
  // Playwright. Must come before ACTIONABLE, which contains `option` for the
  // custom case: a div with role="option" has no Select to drive it and IS
  // clicked, so the tag is what decides.
  //
  // A scan never collects one at all (see interactive.ts). This is for the
  // element added deliberately, which gets a plain getter rather than a call
  // that cannot work.
  if (role === 'option' && tag === 'option') return 'static';
  if (role && ACTIONABLE.has(role)) return 'actionable';
  if (role && TEXT.has(role)) return 'text';

  // Selenium's Select and Playwright's selectOption both require a real
  // <select>; `new Select(div)` throws UnexpectedTagNameException. A custom
  // combobox built from divs is something you click open instead (SPEC §11).
  //
  // An <input role="combobox"> is neither: it is ARIA 1.2's combobox, which is
  // a TEXT FIELD with a popup attached — every autocomplete, every type-ahead,
  // every "search or jump to" box. Lumped in with the div case it got a click
  // and no setter at all, so the one thing the control exists for could not be
  // driven. A <textarea role="combobox"> is the same shape and is explicitly
  // allowed by the ARIA spec.
  if (role === 'combobox') {
    if (tag === 'select') return 'select';
    return tag === 'input' || tag === 'textarea' ? 'text' : 'actionable';
  }
  if (role === 'listbox') return tag === 'select' ? 'multiSelect' : 'actionable';

  if (tag === 'input' && el.inputType && ROLELESS_TEXT_INPUTS.has(el.inputType)) return 'text';
  // file takes clear() + sendKeys(path), the documented upload idiom. color
  // does NOT: measured in Chromium, typing into a colour input leaves the
  // value untouched and clear() sets it to #000000, so a `set` method would
  // report success and silently leave the control black — the same pathology
  // the slider bucket was created for.
  if (tag === 'input' && el.inputType === 'file') return 'text';

  return 'static';
}

/** Static elements are read for assertions; an image has no text, only alt. */
export function isImage(el: Pick<ModelElement, 'role' | 'tag'>): boolean {
  return el.role === 'img' || el.tag === 'img';
}
