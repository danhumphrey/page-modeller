// Selenium WebDriver Java — the reference template (SPEC §11).
//
// Methods only, no wrapper class: `driver` is assumed to be in scope, as in
// v2.5.1. The page-object wrapper is a later opt-in (SPEC §17).
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import type { LocatorCandidate } from '../engine/types';
import { classify, isImage } from './classify';
import { javaMethod, javaName, lowerCamel } from './names';
import { doubleQuoted } from '../quote';
import { classNameFor } from './class-name';
import { frameContext, frameNote, isOpaque } from '../locators/frames';
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
  // Context only: every method below switches for itself.
  const frames = frameContext(el.framePath, '//').map((line) => ` * ${line.replace(/^\/\/ /, '')}`);
  return [`/*`, ` * ${el.name}`, ...frames, ` * ***************************************************************`, ` */`].join('\n');
}

/**
 * Wrap a method so it switches into the element's frame and back out again
 * (SPEC §16). `switchTo` mutates driver state for everything after it, so a
 * method that leaves the driver inside a frame breaks the next one — the
 * `finally` is what makes these safe to call in any order.
 */
function inFrame(method: string, path: FrameStep[]): string {
  const open = method.indexOf('{');
  const header = method.slice(0, open + 1);
  const body = method.slice(open + 1, method.lastIndexOf('}')).replace(/^\n+|\n+$/g, '');
  return [
    header,
    ...frameSwitch(path).map((line) => `    ${line}`),
    '    try {',
    ...body.split('\n').map((line) => (line ? `    ${line}` : line)),
    '    } finally {',
    '        driver.switchTo().defaultContent();',
    '    }',
    '}',
  ].join('\n');
}

function methods(el: ModelElement): string[] {
  const n = el.name;
  const path = el.framePath ?? [];
  // Only a complete chain can be switched into. An opaque one leaves the
  // methods acting on whatever document the driver is already in, which is
  // what the banner warns about.
  const framed = path.length > 0 && !isOpaque(path);

  // No element getter for a framed element: a WebElement goes stale the moment
  // the driver switches away, so handing one back is handing back a guaranteed
  // failure (SPEC §16). Same for the Select wrapper, which holds one.
  const elExpr = framed ? `driver.findElement(${by(activeCandidate(el))})` : `get${n}Element()`;
  const selectExpr = framed ? `new Select(${elExpr})` : `get${n}Select()`;

  // `getClass` is already on Object, so an element called Class cannot have the
  // plain getter its bucket would otherwise give it.
  const getValue = javaMethod(`get${n}`);

  const out: string[] = framed
    ? []
    : [`public WebElement get${n}Element() {\n    return driver.findElement(${by(activeCandidate(el))});\n}`];

  switch (classify(el)) {
    case 'actionable':
      out.push(`public void click${n}() {\n    ${elExpr}.click();\n}`);
      break;

    case 'text':
      out.push(
        // getDomProperty, not getAttribute: the attribute is the INITIAL value
        // and does not change as the user types (Selenium 4.5+).
        `public String ${getValue}() {\n    return ${elExpr}.getDomProperty("value");\n}`,
        // Clearing is the default, because v2.5.1's setter appended and almost
        // nobody wanted that. An overload keeps appending available rather than
        // trading one hard-coded behaviour for the other — Java has no default
        // arguments, so it is two methods.
        `public void set${n}(String value) {\n    set${n}(value, true);\n}`,
        `public void set${n}(String value, boolean clearFirst) {\n    WebElement el = ${elExpr};\n    if (clearFirst) {\n        el.clear();\n    }\n    el.sendKeys(value);\n}`
      );
      break;

    case 'slider':
      out.push(
        `public String ${getValue}() {\n    return ${elExpr}.getDomProperty("value");\n}`,
        // The keyboard is the whole API a range offers, so these are it.
        `public void increment${n}() {\n    ${elExpr}.sendKeys(Keys.ARROW_RIGHT);\n}`,
        `public void decrement${n}() {\n    ${elExpr}.sendKeys(Keys.ARROW_LEFT);\n}`,
        `public void set${n}ToMin() {\n    ${elExpr}.sendKeys(Keys.HOME);\n}`,
        `public void set${n}ToMax() {\n    ${elExpr}.sendKeys(Keys.END);\n}`,
        // Steps from wherever it is, rather than resetting to min first: fewer
        // presses, and min and step never have to be read.
        `public void set${n}(String value) {\n` +
          `    WebElement el = ${elExpr};\n` +
          `    double target = Double.parseDouble(value);\n` +
          `    double now = Double.parseDouble(el.getDomProperty("value"));\n` +
          `    while (now != target) {\n` +
          `        boolean up = now < target;\n` +
          `        el.sendKeys(up ? Keys.ARROW_RIGHT : Keys.ARROW_LEFT);\n` +
          `        double next = Double.parseDouble(el.getDomProperty("value"));\n` +
          `        // Clamped at an end, or stepped past a value this slider\n` +
          `        // cannot land on. Either way it goes no closer.\n` +
          `        if (next == now || (up ? next > target : next < target)) return;\n` +
          `        now = next;\n` +
          `    }\n}`
      );
      break;

    case 'toggle':
      out.push(
        `public boolean is${n}Checked() {\n    return ${elExpr}.isSelected();\n}`,
        `public void set${n}(boolean checked) {\n    WebElement el = ${elExpr};\n    if (el.isSelected() != checked) {\n        el.click();\n    }\n}`
      );
      break;

    case 'radio':
      // No set(false): clicking a checked radio does not uncheck it, so
      // v2.5.1's setter silently did nothing. Selecting is the only real verb.
      out.push(
        `public boolean is${n}Selected() {\n    return ${elExpr}.isSelected();\n}`,
        `public void select${n}() {\n    WebElement el = ${elExpr};\n    if (!el.isSelected()) {\n        el.click();\n    }\n}`
      );
      break;

    case 'select':
      out.push(
        ...(framed ? [] : [`public Select get${n}Select() {\n    return new Select(${elExpr});\n}`]),
        `public String get${n}Text() {\n    return ${selectExpr}.getFirstSelectedOption().getText();\n}`,
        `public String get${n}Value() {\n    return ${selectExpr}.getFirstSelectedOption().getDomProperty("value");\n}`,
        `public void set${n}ByValue(String value) {\n    ${selectExpr}.selectByValue(value);\n}`,
        `public void set${n}ByText(String text) {\n    ${selectExpr}.selectByVisibleText(text);\n}`
      );
      break;

    case 'multiSelect':
      out.push(
        ...(framed ? [] : [`public Select get${n}Select() {\n    return new Select(${elExpr});\n}`]),
        // getAllSelectedOptions, not getFirstSelectedOption: the first of N is
        // not the answer to "what is selected".
        `public List<String> get${n}Texts() {\n    return ${selectExpr}.getAllSelectedOptions().stream()\n        .map(WebElement::getText)\n        .collect(Collectors.toList());\n}`,
        `public List<String> get${n}Values() {\n    return ${selectExpr}.getAllSelectedOptions().stream()\n        .map(o -> o.getDomProperty("value"))\n        .collect(Collectors.toList());\n}`,
        // deselectAll first, or selectByValue ADDS to the selection and `set`
        // does not mean set.
        `public void set${n}ByValues(String... values) {\n    Select el = ${selectExpr};\n    el.deselectAll();\n    for (String value : values) {\n        el.selectByValue(value);\n    }\n}`,
        `public void set${n}ByTexts(String... texts) {\n    Select el = ${selectExpr};\n    el.deselectAll();\n    for (String text : texts) {\n        el.selectByVisibleText(text);\n    }\n}`,
        // Only for a multi-select: deselectAll throws
        // UnsupportedOperationException on a single one.
        `public void deselectAll${n}() {\n    ${selectExpr}.deselectAll();\n}`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? // getText() on an <img> returns an empty string; alt is the text.
            `public String get${n}AltText() {\n    return ${elExpr}.getDomAttribute("alt");\n}`
          : `public String ${getValue}() {\n    return ${elExpr}.getText();\n}`
      );
      break;
  }

  // A method that never touches the driver has nothing to switch for — the
  // convenience overload just calls its sibling, which switches for itself.
  return framed ? out.map((m) => (m.includes('driver.') ? inFrame(m, path) : m)) : out;
}

/**
 * Locators only (SPEC §11): `By` fields to paste into your own page object.
 * `final`, because a `By` is an immutable description of how to find something.
 */
export function generateSeleniumJavaLocators(model: TabModel): string {
  return model.elements
    .flatMap((el) => [...frameNote(el.framePath, '//', frameSwitch), `private final By ${javaName(lowerCamel(el.name))} = ${by(activeCandidate(el))};`])
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
    ...(buckets.has('slider') ? ['org.openqa.selenium.Keys'] : []),
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
