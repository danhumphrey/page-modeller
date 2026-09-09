// Selenium WebDriver Python (SPEC §11).
//
// Functions, not methods: `driver` is assumed to be in scope, as in the Java
// and C# templates. PEP 8 throughout — snake_case, two blank lines between
// top-level definitions, four-space indent.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import type { LocatorCandidate } from '../engine/types';
import { byParts, type ByKind } from './selenium';
import { classify, isImage } from './classify';
import { snake, upperSnake } from './names';
import { doubleQuoted } from '../quote';
import { classNameFor } from './class-name';
import { frameNote } from '../locators/frames';
import type { FrameStep } from '../engine/types';

/** Double-quoted, Black's default. */
const q = doubleQuoted;

const BY: Record<ByKind, string> = {
  id: 'ID',
  name: 'NAME',
  className: 'CLASS_NAME',
  tagName: 'TAG_NAME',
  linkText: 'LINK_TEXT',
  partialLinkText: 'PARTIAL_LINK_TEXT',
  css: 'CSS_SELECTOR',
  xpath: 'XPATH',
};

/** The `(By.X, "value")` pair — Python's locator is a tuple, not an object. */
function byTuple(c: LocatorCandidate): string {
  const parts = byParts(c);
  return parts ? `(By.${BY[parts.kind]}, ${q(parts.value)})` : `None  # ${c.kind} is not expressible in Selenium`;
}

function find(c: LocatorCandidate, recv: string): string {
  const parts = byParts(c);
  return parts ? `${recv}driver.find_element(By.${BY[parts.kind]}, ${q(parts.value)})` : byTuple(c);
}

/** The switch a reader can paste, one line per level, outermost first. */
const frameSwitch = (path: FrameStep[]) => [
  'driver.switch_to.default_content()',
  ...path.map((s) => {
    const parts = byParts(s.frame);
    return `driver.switch_to.frame(driver.find_element(By.${BY[parts!.kind]}, ${q(parts!.value)}))`;
  }),
];

function banner(el: ModelElement): string {
  const rule = '#'.repeat(63);
  return [rule, `# ${el.name}`, ...frameNote(el.framePath, '#', frameSwitch), rule].join('\n');
}

/**
 * `recv` is what a definition refers to itself through: nothing for the module
 * functions, `self.` inside a class. Python has no implicit receiver, so this
 * cannot be a wrapper the way it can in Java and C# — every call site changes.
 */
function methods(el: ModelElement, recv: string): string[] {
  const n = snake(el.name);
  // `def f()` at module level, `def f(self)` in a class — and `self` goes
  // first, ahead of any real arguments.
  const def = (sig: string) => {
    if (!recv) return `def ${sig}`;
    const open = sig.indexOf('(');
    const args = sig.slice(open + 1, -1);
    return `def ${sig.slice(0, open)}(self${args ? `, ${args}` : ''})`;
  };
  const out: string[] = [`${def(`get_${n}_element()`)}:\n    return ${find(activeCandidate(el), recv)}`];

  switch (classify(el)) {
    case 'actionable':
      out.push(`${def(`click_${n}()`)}:\n    ${recv}get_${n}_element().click()`);
      break;

    case 'text':
      out.push(
        // get_dom_property, not get_attribute: the attribute is the INITIAL
        // value and does not change as the user types (Selenium 4.5+).
        `${def(`get_${n}()`)}:\n    return ${recv}get_${n}_element().get_dom_property("value")`,
        // One function: Python has default arguments.
        `${def(`set_${n}(value, clear_first=True)`)}:\n    el = ${recv}get_${n}_element()\n    if clear_first:\n        el.clear()\n    el.send_keys(value)`
      );
      break;

    case 'toggle':
      out.push(
        `${def(`is_${n}_checked()`)}:\n    return ${recv}get_${n}_element().is_selected()`,
        `${def(`set_${n}(checked)`)}:\n    el = ${recv}get_${n}_element()\n    if el.is_selected() != checked:\n        el.click()`
      );
      break;

    case 'radio':
      out.push(
        `${def(`is_${n}_selected()`)}:\n    return ${recv}get_${n}_element().is_selected()`,
        `${def(`select_${n}()`)}:\n    el = ${recv}get_${n}_element()\n    if not el.is_selected():\n        el.click()`
      );
      break;

    case 'select':
      out.push(
        `${def(`get_${n}_select()`)}:\n    return Select(${recv}get_${n}_element())`,
        `${def(`get_${n}_text()`)}:\n    return ${recv}get_${n}_select().first_selected_option.text`,
        `${def(`get_${n}_value()`)}:\n    return ${recv}get_${n}_select().first_selected_option.get_dom_property("value")`,
        `${def(`set_${n}_by_value(value)`)}:\n    ${recv}get_${n}_select().select_by_value(value)`,
        `${def(`set_${n}_by_text(text)`)}:\n    ${recv}get_${n}_select().select_by_visible_text(text)`
      );
      break;

    case 'multiSelect':
      out.push(
        `${def(`get_${n}_select()`)}:\n    return Select(${recv}get_${n}_element())`,
        `${def(`get_${n}_texts()`)}:\n    return [o.text for o in ${recv}get_${n}_select().all_selected_options]`,
        `${def(`get_${n}_values()`)}:\n    return [o.get_dom_property("value") for o in ${recv}get_${n}_select().all_selected_options]`,
        // deselect_all first, or select_by_value ADDS to the selection.
        `${def(`set_${n}_by_values(*values)`)}:\n    el = ${recv}get_${n}_select()\n    el.deselect_all()\n    for value in values:\n        el.select_by_value(value)`,
        `${def(`set_${n}_by_texts(*texts)`)}:\n    el = ${recv}get_${n}_select()\n    el.deselect_all()\n    for text in texts:\n        el.select_by_visible_text(text)`,
        `${def(`deselect_all_${n}()`)}:\n    ${recv}get_${n}_select().deselect_all()`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? `${def(`get_${n}_alt_text()`)}:\n    return ${recv}get_${n}_element().get_dom_attribute("alt")`
          : `${def(`get_${n}()`)}:\n    return ${recv}get_${n}_element().text`
      );
      break;
  }

  return out;
}

/**
 * Locator tuples, the Python page-object convention — module constants, then
 * `driver.find_element(*EMAIL_ADDRESS)` at the call site.
 */
export function generateSeleniumPythonLocators(model: TabModel): string {
  return model.elements
    .flatMap((el) => [...frameNote(el.framePath, '#', frameSwitch), `${upperSnake(el.name)} = ${byTuple(activeCandidate(el))}`])
    .join('\n');
}

export function generateSeleniumPython(model: TabModel): string {
  // Two blank lines between top-level definitions, per PEP 8.
  return model.elements.map((el) => [banner(el), ...methods(el, '')].join('\n\n\n')).join('\n\n\n');
}

/** The methods as a class (SPEC §17). One blank line between methods, per PEP 8. */
export function generateSeleniumPythonPageObject(model: TabModel): string {
  const buckets = new Set(model.elements.map(classify));
  const imports = [
    'from selenium.webdriver.common.by import By',
    ...(buckets.has('select') || buckets.has('multiSelect')
      ? ['from selenium.webdriver.support.ui import Select']
      : []),
  ];

  return [
    ...imports,
    '',
    '',
    `class ${classNameFor(model.url)}:`,
    '    def __init__(self, driver):',
    '        self.driver = driver',
    // One blank line between methods, per PEP 8 — two is for top level.
    ...model.elements.flatMap((el) => ['', indent(banner(el)), ...methods(el, 'self.').map(indent).join('\n\n').split('\n')]),
    '',
  ].join('\n');
}

/** Four spaces onto every non-blank line, so the definitions sit in the class. */
function indent(block: string): string {
  return block
    .split('\n')
    .map((line) => (line ? `    ${line}` : line))
    .join('\n');
}
