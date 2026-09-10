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
import { frameContext, frameNote, isOpaque } from '../locators/frames';
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

/** `By.X, "value"` — the arguments find_element and switch_to.frame share. */
function findArgs(c: LocatorCandidate): string {
  const parts = byParts(c);
  return parts ? `By.${BY[parts.kind]}, ${q(parts.value)}` : 'None';
}

function find(c: LocatorCandidate, recv: string): string {
  const parts = byParts(c);
  return parts ? `${recv}driver.find_element(${findArgs(c)})` : byTuple(c);
}

/** The switch a reader can paste, one line per level, outermost first. */
const frameSwitch = (path: FrameStep[], recv = '') => [
  `${recv}driver.switch_to.default_content()`,
  ...path.map((s) => `${recv}driver.switch_to.frame(${recv}driver.find_element(${findArgs(s.frame)}))`),
];

function banner(el: ModelElement): string {
  const rule = '#'.repeat(63);
  // Context only: every definition below switches for itself.
  return [rule, `# ${el.name}`, ...frameContext(el.framePath, '#'), rule].join('\n');
}

/**
 * `recv` is what a definition refers to itself through: nothing for the module
 * functions, `self.` inside a class. Python has no implicit receiver, so this
 * cannot be a wrapper the way it can in Java and C# — every call site changes.
 */
/** See selenium-java.ts: switch_to mutates driver state, so the finally matters. */
function inFrame(method: string, path: FrameStep[], recv: string): string {
  const colon = method.indexOf(':\n');
  const header = method.slice(0, colon + 1);
  const body = method.slice(colon + 2);
  return [
    header,
    ...frameSwitch(path, recv).map((line) => `    ${line}`),
    '    try:',
    ...body.split('\n').map((line) => (line ? `    ${line}` : line)),
    '    finally:',
    `        ${recv}driver.switch_to.default_content()`,
  ].join('\n');
}

function methods(el: ModelElement, recv: string): string[] {
  const n = snake(el.name);
  const path = el.framePath ?? [];
  const framed = path.length > 0 && !isOpaque(path);

  // No element getter for a framed element: the WebElement goes stale the
  // moment the driver switches away (SPEC §16).
  const elExpr = framed
    ? `${recv}driver.find_element(${findArgs(activeCandidate(el))})`
    : `${recv}get_${n}_element()`;
  const selectExpr = framed ? `Select(${elExpr})` : `${recv}get_${n}_select()`;
  // `def f()` at module level, `def f(self)` in a class — and `self` goes
  // first, ahead of any real arguments.
  const def = (sig: string) => {
    if (!recv) return `def ${sig}`;
    const open = sig.indexOf('(');
    const args = sig.slice(open + 1, -1);
    return `def ${sig.slice(0, open)}(self${args ? `, ${args}` : ''})`;
  };
  const out: string[] = framed
    ? []
    : [`${def(`get_${n}_element()`)}:\n    return ${find(activeCandidate(el), recv)}`];

  switch (classify(el)) {
    case 'actionable':
      out.push(`${def(`click_${n}()`)}:\n    ${elExpr}.click()`);
      break;

    case 'text':
      out.push(
        // get_property, not get_attribute: the attribute is the INITIAL value
        // and does not change as the user types. And `get_property`, not
        // `get_dom_property` — that is Java's and C#'s spelling, and Python has
        // no such method. Caught by running it (tests/selenium.run.spec.ts); no
        // compiler or parser could have.
        `${def(`get_${n}()`)}:\n    return ${elExpr}.get_property("value")`,
        // One function: Python has default arguments.
        `${def(`set_${n}(value, clear_first=True)`)}:\n    el = ${elExpr}\n    if clear_first:\n        el.clear()\n    el.send_keys(value)`
      );
      break;

    case 'slider':
      out.push(
        `${def(`get_${n}()`)}:\n    return ${elExpr}.get_property("value")`,
        // The keyboard is the whole API a range offers, so these are it.
        `${def(`increment_${n}()`)}:\n    ${elExpr}.send_keys(Keys.ARROW_RIGHT)`,
        `${def(`decrement_${n}()`)}:\n    ${elExpr}.send_keys(Keys.ARROW_LEFT)`,
        `${def(`set_${n}_to_min()`)}:\n    ${elExpr}.send_keys(Keys.HOME)`,
        `${def(`set_${n}_to_max()`)}:\n    ${elExpr}.send_keys(Keys.END)`,
        // Steps from wherever it is, rather than resetting to min first: fewer
        // presses, and min and step never have to be read.
        `${def(`set_${n}(value)`)}:\n` +
          `    el = ${elExpr}\n` +
          `    target = float(value)\n` +
          `    now = float(el.get_property("value"))\n` +
          `    while now != target:\n` +
          `        up = now < target\n` +
          `        el.send_keys(Keys.ARROW_RIGHT if up else Keys.ARROW_LEFT)\n` +
          `        moved = float(el.get_property("value"))\n` +
          `        # Clamped at an end, or stepped past a value this slider\n` +
          `        # cannot land on. Either way it goes no closer.\n` +
          `        if moved == now or (moved > target if up else moved < target):\n` +
          `            return\n` +
          `        now = moved`
      );
      break;

    case 'toggle':
      out.push(
        `${def(`is_${n}_checked()`)}:\n    return ${elExpr}.is_selected()`,
        `${def(`set_${n}(checked)`)}:\n    el = ${elExpr}\n    if el.is_selected() != checked:\n        el.click()`
      );
      break;

    case 'radio':
      out.push(
        `${def(`is_${n}_selected()`)}:\n    return ${elExpr}.is_selected()`,
        `${def(`select_${n}()`)}:\n    el = ${elExpr}\n    if not el.is_selected():\n        el.click()`
      );
      break;

    case 'select':
      out.push(
        ...(framed ? [] : [`${def(`get_${n}_select()`)}:\n    return Select(${elExpr})`]),
        `${def(`get_${n}_text()`)}:\n    return ${selectExpr}.first_selected_option.text`,
        `${def(`get_${n}_value()`)}:\n    return ${selectExpr}.first_selected_option.get_property("value")`,
        `${def(`set_${n}_by_value(value)`)}:\n    ${selectExpr}.select_by_value(value)`,
        `${def(`set_${n}_by_text(text)`)}:\n    ${selectExpr}.select_by_visible_text(text)`
      );
      break;

    case 'multiSelect':
      out.push(
        ...(framed ? [] : [`${def(`get_${n}_select()`)}:\n    return Select(${elExpr})`]),
        `${def(`get_${n}_texts()`)}:\n    return [o.text for o in ${selectExpr}.all_selected_options]`,
        `${def(`get_${n}_values()`)}:\n    return [o.get_property("value") for o in ${selectExpr}.all_selected_options]`,
        // deselect_all first, or select_by_value ADDS to the selection.
        `${def(`set_${n}_by_values(*values)`)}:\n    el = ${selectExpr}\n    el.deselect_all()\n    for value in values:\n        el.select_by_value(value)`,
        `${def(`set_${n}_by_texts(*texts)`)}:\n    el = ${selectExpr}\n    el.deselect_all()\n    for text in texts:\n        el.select_by_visible_text(text)`,
        `${def(`deselect_all_${n}()`)}:\n    ${selectExpr}.deselect_all()`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? `${def(`get_${n}_alt_text()`)}:\n    return ${elExpr}.get_dom_attribute("alt")`
          : `${def(`get_${n}()`)}:\n    return ${elExpr}.text`
      );
      break;
  }

  return framed ? out.map((m) => (m.includes('driver.') ? inFrame(m, path, recv) : m)) : out;
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
    ...(buckets.has('slider') ? ['from selenium.webdriver.common.keys import Keys'] : []),
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
