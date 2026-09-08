// Playwright, TypeScript (SPEC §12). The primary target.
//
// Not a translation of the Selenium template: the API differs enough to change
// the shape. Locators are lazy, so a getter costs nothing and never goes stale;
// auto-waiting removes explicit waits; and `fill`, `check` and `selectOption`
// replace several hand-rolled sequences.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import { playwrightExpr } from '../locators/display';
import { classify, isImage } from './classify';

function banner(name: string): string {
  return `/*\n * ${name}\n * ***************************************************************\n */`;
}

/** The locator getter every element gets. `page` is assumed in scope, as
 *  `driver` is in the Selenium template. */
function locator(el: ModelElement): string {
  return `get${el.name}Locator(): Locator {\n    return page.${playwrightExpr(activeCandidate(el))};\n}`;
}

function methods(el: ModelElement): string[] {
  const n = el.name;
  const loc = `get${n}Locator()`;
  const out: string[] = [locator(el)];

  switch (classify(el)) {
    case 'actionable':
      out.push(`async click${n}(): Promise<void> {\n    await ${loc}.click();\n}`);
      break;

    case 'text':
      out.push(
        `async get${n}(): Promise<string> {\n    return ${loc}.inputValue();\n}`,
        // fill() clears by construction, so v2.5.1's append-by-accident cannot
        // happen here. Appending is still reachable, as in the Selenium
        // template — TypeScript has default arguments, so it is one method.
        `async set${n}(value: string, clearFirst = true): Promise<void> {\n    if (clearFirst) {\n        await ${loc}.fill(value);\n    } else {\n        await ${loc}.pressSequentially(value);\n    }\n}`
      );
      break;

    case 'toggle':
      out.push(
        `async is${n}Checked(): Promise<boolean> {\n    return ${loc}.isChecked();\n}`,
        // check/uncheck are real primitives; no click-to-toggle dance, and they
        // verify the resulting state themselves.
        `async set${n}(checked: boolean): Promise<void> {\n    await (checked ? ${loc}.check() : ${loc}.uncheck());\n}`
      );
      break;

    case 'radio':
      // uncheck() throws on a radio, which is Playwright agreeing that
      // v2.5.1's set(false) never meant anything.
      out.push(
        `async is${n}Selected(): Promise<boolean> {\n    return ${loc}.isChecked();\n}`,
        `async select${n}(): Promise<void> {\n    await ${loc}.check();\n}`
      );
      break;

    case 'select':
      out.push(
        `async get${n}Value(): Promise<string> {\n    return ${loc}.inputValue();\n}`,
        `async set${n}ByValue(value: string): Promise<void> {\n    await ${loc}.selectOption({ value });\n}`,
        `async set${n}ByText(label: string): Promise<void> {\n    await ${loc}.selectOption({ label });\n}`
      );
      break;

    case 'multiSelect':
      out.push(
        `async get${n}Values(): Promise<string[]> {\n    return ${loc}.evaluate((el: HTMLSelectElement) =>\n        Array.from(el.selectedOptions, (o) => o.value)\n    );\n}`,
        // selectOption replaces the whole selection, so there is no deselectAll
        // step and no way to accidentally add to what was already chosen.
        `async set${n}ByValues(...values: string[]): Promise<void> {\n    await ${loc}.selectOption(values.map((value) => ({ value })));\n}`,
        `async set${n}ByTexts(...labels: string[]): Promise<void> {\n    await ${loc}.selectOption(labels.map((label) => ({ label })));\n}`,
        `async deselectAll${n}(): Promise<void> {\n    await ${loc}.selectOption([]);\n}`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? `async get${n}AltText(): Promise<string | null> {\n    return ${loc}.getAttribute('alt');\n}`
          : `async get${n}(): Promise<string | null> {\n    return ${loc}.textContent();\n}`
      );
      break;
  }

  return out;
}

export function generatePlaywrightTs(model: TabModel): string {
  return model.elements.map((el) => [banner(el.name), ...methods(el)].join('\n\n')).join('\n\n');
}
