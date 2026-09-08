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

/** Python string literal, double-quoted (Black's default). */
const q = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

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
  return parts ? `(By.${BY[parts.kind]}, ${q(parts.value)})` : `# ${c.kind} is not expressible in Selenium`;
}

function find(c: LocatorCandidate): string {
  const parts = byParts(c);
  return parts ? `driver.find_element(By.${BY[parts.kind]}, ${q(parts.value)})` : byTuple(c);
}

function banner(name: string): string {
  const rule = '#'.repeat(63);
  return `${rule}\n# ${name}\n${rule}`;
}

function methods(el: ModelElement): string[] {
  const n = snake(el.name);
  const out: string[] = [`def get_${n}_element():\n    return ${find(activeCandidate(el))}`];

  switch (classify(el)) {
    case 'actionable':
      out.push(`def click_${n}():\n    get_${n}_element().click()`);
      break;

    case 'text':
      out.push(
        // get_dom_property, not get_attribute: the attribute is the INITIAL
        // value and does not change as the user types (Selenium 4.5+).
        `def get_${n}():\n    return get_${n}_element().get_dom_property("value")`,
        // One function: Python has default arguments.
        `def set_${n}(value, clear_first=True):\n    el = get_${n}_element()\n    if clear_first:\n        el.clear()\n    el.send_keys(value)`
      );
      break;

    case 'toggle':
      out.push(
        `def is_${n}_checked():\n    return get_${n}_element().is_selected()`,
        `def set_${n}(checked):\n    el = get_${n}_element()\n    if el.is_selected() != checked:\n        el.click()`
      );
      break;

    case 'radio':
      out.push(
        `def is_${n}_selected():\n    return get_${n}_element().is_selected()`,
        `def select_${n}():\n    el = get_${n}_element()\n    if not el.is_selected():\n        el.click()`
      );
      break;

    case 'select':
      out.push(
        `def get_${n}_select():\n    return Select(get_${n}_element())`,
        `def get_${n}_text():\n    return get_${n}_select().first_selected_option.text`,
        `def get_${n}_value():\n    return get_${n}_select().first_selected_option.get_dom_property("value")`,
        `def set_${n}_by_value(value):\n    get_${n}_select().select_by_value(value)`,
        `def set_${n}_by_text(text):\n    get_${n}_select().select_by_visible_text(text)`
      );
      break;

    case 'multiSelect':
      out.push(
        `def get_${n}_select():\n    return Select(get_${n}_element())`,
        `def get_${n}_texts():\n    return [o.text for o in get_${n}_select().all_selected_options]`,
        `def get_${n}_values():\n    return [o.get_dom_property("value") for o in get_${n}_select().all_selected_options]`,
        // deselect_all first, or select_by_value ADDS to the selection.
        `def set_${n}_by_values(*values):\n    el = get_${n}_select()\n    el.deselect_all()\n    for value in values:\n        el.select_by_value(value)`,
        `def set_${n}_by_texts(*texts):\n    el = get_${n}_select()\n    el.deselect_all()\n    for text in texts:\n        el.select_by_visible_text(text)`,
        `def deselect_all_${n}():\n    get_${n}_select().deselect_all()`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? `def get_${n}_alt_text():\n    return get_${n}_element().get_dom_attribute("alt")`
          : `def get_${n}():\n    return get_${n}_element().text`
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
  return model.elements.map((el) => `${upperSnake(el.name)} = ${byTuple(activeCandidate(el))}`).join('\n');
}

export function generateSeleniumPython(model: TabModel): string {
  // Two blank lines between top-level definitions, per PEP 8.
  return model.elements.map((el) => [banner(el.name), ...methods(el)].join('\n\n\n')).join('\n\n\n');
}
