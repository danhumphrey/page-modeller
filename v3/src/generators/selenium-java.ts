// Selenium WebDriver Java — the reference template (SPEC §11).
//
// Methods only, no wrapper class: `driver` is assumed to be in scope, as in
// v2.5.1. The page-object wrapper is a later opt-in (SPEC §17).
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import type { LocatorCandidate } from '../engine/types';
import { classify, isImage } from './classify';
import { lowerCamel } from './names';
import { doubleQuoted } from '../quote';
import { classNameFor } from './class-name';
import { frameNote } from '../locators/frames';
import type { FrameStep } from '../engine/types';

const q = doubleQuoted;

function by(c: LocatorCandidate): string {
  switch (c.kind) {
    case 'id':
      return `By.id(${q(c.value)})`;
    case 'name':
      return `By.name(${q(c.value)})`;
    case 'className':
      return `By.className(${q(c.value)})`;
    case 'tagName':
      return `By.tagName(${q(c.value)})`;
    case 'linkText':
      return `By.linkText(${q(c.text)})`;
    case 'partialLinkText':
      return `By.partialLinkText(${q(c.text)})`;
    case 'css':
      return `By.cssSelector(${q(c.value)})`;
    case 'xpath':
      return `By.xpath(${q(c.value)})`;
    default:
      // Selection only ever picks a type the framework can express (SPEC §7),
      // so this is unreachable — but say so rather than emitting nothing, and
      // keep it parseable: a syntax error names a column, not an element.
      return `null /* ${c.kind} is not expressible in Selenium */`;
  }
}

/** The switch a reader can paste, one line per level, outermost first. */
const frameSwitch = (path: FrameStep[]) => [
  'driver.switchTo().defaultContent();',
  ...path.map((s) => `driver.switchTo().frame(driver.findElement(${by(s.frame)}));`),
];

function banner(el: ModelElement): string {
  // The frame chain goes in the banner, where a reader is already looking to
  // see what this block is about (SPEC §16).
  const frames = frameNote(el.framePath, '//', frameSwitch).map((line) => ` * ${line.replace(/^\/\/ /, '')}`);
  return [`/*`, ` * ${el.name}`, ...frames, ` * ***************************************************************`, ` */`].join('\n');
}

function methods(el: ModelElement): string[] {
  const n = el.name;
  const out: string[] = [
    `public WebElement get${n}Element() {\n    return driver.findElement(${by(activeCandidate(el))});\n}`,
  ];

  switch (classify(el)) {
    case 'actionable':
      out.push(`public void click${n}() {\n    get${n}Element().click();\n}`);
      break;

    case 'text':
      out.push(
        // getDomProperty, not getAttribute: the attribute is the INITIAL value
        // and does not change as the user types (Selenium 4.5+).
        `public String get${n}() {\n    return get${n}Element().getDomProperty("value");\n}`,
        // Clearing is the default, because v2.5.1's setter appended and almost
        // nobody wanted that. An overload keeps appending available rather than
        // trading one hard-coded behaviour for the other — Java has no default
        // arguments, so it is two methods.
        `public void set${n}(String value) {\n    set${n}(value, true);\n}`,
        `public void set${n}(String value, boolean clearFirst) {\n    WebElement el = get${n}Element();\n    if (clearFirst) {\n        el.clear();\n    }\n    el.sendKeys(value);\n}`
      );
      break;

    case 'toggle':
      out.push(
        `public boolean is${n}Checked() {\n    return get${n}Element().isSelected();\n}`,
        `public void set${n}(boolean checked) {\n    WebElement el = get${n}Element();\n    if (el.isSelected() != checked) {\n        el.click();\n    }\n}`
      );
      break;

    case 'radio':
      // No set(false): clicking a checked radio does not uncheck it, so
      // v2.5.1's setter silently did nothing. Selecting is the only real verb.
      out.push(
        `public boolean is${n}Selected() {\n    return get${n}Element().isSelected();\n}`,
        `public void select${n}() {\n    WebElement el = get${n}Element();\n    if (!el.isSelected()) {\n        el.click();\n    }\n}`
      );
      break;

    case 'select':
      out.push(
        `public Select get${n}Select() {\n    return new Select(get${n}Element());\n}`,
        `public String get${n}Text() {\n    return get${n}Select().getFirstSelectedOption().getText();\n}`,
        `public String get${n}Value() {\n    return get${n}Select().getFirstSelectedOption().getDomProperty("value");\n}`,
        `public void set${n}ByValue(String value) {\n    get${n}Select().selectByValue(value);\n}`,
        `public void set${n}ByText(String text) {\n    get${n}Select().selectByVisibleText(text);\n}`
      );
      break;

    case 'multiSelect':
      out.push(
        `public Select get${n}Select() {\n    return new Select(get${n}Element());\n}`,
        // getAllSelectedOptions, not getFirstSelectedOption: the first of N is
        // not the answer to "what is selected".
        `public List<String> get${n}Texts() {\n    return get${n}Select().getAllSelectedOptions().stream()\n        .map(WebElement::getText)\n        .collect(Collectors.toList());\n}`,
        `public List<String> get${n}Values() {\n    return get${n}Select().getAllSelectedOptions().stream()\n        .map(o -> o.getDomProperty("value"))\n        .collect(Collectors.toList());\n}`,
        // deselectAll first, or selectByValue ADDS to the selection and `set`
        // does not mean set.
        `public void set${n}ByValues(String... values) {\n    Select el = get${n}Select();\n    el.deselectAll();\n    for (String value : values) {\n        el.selectByValue(value);\n    }\n}`,
        `public void set${n}ByTexts(String... texts) {\n    Select el = get${n}Select();\n    el.deselectAll();\n    for (String text : texts) {\n        el.selectByVisibleText(text);\n    }\n}`,
        // Only for a multi-select: deselectAll throws
        // UnsupportedOperationException on a single one.
        `public void deselectAll${n}() {\n    get${n}Select().deselectAll();\n}`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? // getText() on an <img> returns an empty string; alt is the text.
            `public String get${n}AltText() {\n    return get${n}Element().getDomAttribute("alt");\n}`
          : `public String get${n}() {\n    return get${n}Element().getText();\n}`
      );
      break;
  }

  return out;
}

/**
 * Locators only (SPEC §11): `By` fields to paste into your own page object.
 * `final`, because a `By` is an immutable description of how to find something.
 */
export function generateSeleniumJavaLocators(model: TabModel): string {
  return model.elements
    .flatMap((el) => [...frameNote(el.framePath, '//', frameSwitch), `private final By ${lowerCamel(el.name)} = ${by(activeCandidate(el))};`])
    .join('\n');
}

export function generateSeleniumJava(model: TabModel): string {
  return model.elements.map((el) => [banner(el), ...methods(el)].join('\n\n')).join('\n\n');
}

/**
 * The methods with a class around them (SPEC §17): imports, a declaration, and
 * a constructor taking the `driver` they otherwise reference bare.
 *
 * Imports are computed from what the model actually contains. An unused import
 * is legal and harmless, but it is also the first thing a reviewer notices.
 */
export function generateSeleniumJavaPageObject(model: TabModel): string {
  const buckets = new Set(model.elements.map(classify));
  const imports = [
    ...(buckets.has('multiSelect') ? ['java.util.List', 'java.util.stream.Collectors'] : []),
    'org.openqa.selenium.By',
    'org.openqa.selenium.WebDriver',
    'org.openqa.selenium.WebElement',
    ...(buckets.has('select') || buckets.has('multiSelect') ? ['org.openqa.selenium.support.ui.Select'] : []),
  ];
  const className = classNameFor(model.url);

  return [
    ...imports.map((i) => `import ${i};`),
    '',
    `public class ${className} {`,
    '    private final WebDriver driver;',
    '',
    `    public ${className}(WebDriver driver) {`,
    '        this.driver = driver;',
    '    }',
    ...model.elements.flatMap((el) => [
      '',
      indent(banner(el)),
      ...methods(el).map(indent).join('\n\n').split('\n'),
    ]),
    '}',
    '',
  ].join('\n');
}

/** Four spaces onto every non-blank line, so the fragment sits inside a class. */
function indent(block: string): string {
  return block
    .split('\n')
    .map((line) => (line ? `    ${line}` : line))
    .join('\n');
}
