// Selenium WebDriver C# (SPEC §11).
//
// The Java template's structure in C# idiom: PascalCase methods, Allman
// braces, properties where Selenium exposes properties (`Selected`, `Text`),
// and default arguments instead of Java's overload — C# has them.
import { activeCandidate, type ModelElement, type TabModel } from '../model';
import type { LocatorCandidate } from '../engine/types';
import { byParts, type ByKind } from './selenium';
import { classify, isImage } from './classify';
import { underscoreCamel } from './names';
import { doubleQuoted } from '../quote';
import { classNameOf } from './class-name';
import { frameContext, frameNote, isOpaque } from '../locators/frames';
import type { FrameStep } from '../engine/types';

const q = doubleQuoted;

const BY: Record<ByKind, string> = {
  id: 'Id',
  name: 'Name',
  className: 'ClassName',
  tagName: 'TagName',
  linkText: 'LinkText',
  partialLinkText: 'PartialLinkText',
  css: 'CssSelector',
  xpath: 'XPath',
};

function by(c: LocatorCandidate): string {
  const parts = byParts(c);
  return parts ? `By.${BY[parts.kind]}(${q(parts.value)})` : `null /* ${c.kind} is not expressible in Selenium */`;
}

/** The switch a reader can paste, one line per level, outermost first. */
const frameSwitch = (path: FrameStep[]) => [
  'driver.SwitchTo().DefaultContent();',
  ...path.map((s) => `driver.SwitchTo().Frame(driver.FindElement(${by(s.frame)}));`),
];

function banner(el: ModelElement): string {
  // The frame chain goes in the banner, where a reader is already looking to
  // see what this block is about (SPEC §16).
  // Context only: every method below switches for itself.
  const frames = frameContext(el.framePath, '//').map((line) => ` * ${line.replace(/^\/\/ /, '')}`);
  return [`/*`, ` * ${el.name}`, ...frames, ` * ***************************************************************`, ` */`].join('\n');
}

/** See selenium-java.ts: switchTo mutates driver state, so the finally matters. */
function inFrame(method: string, path: FrameStep[]): string {
  const open = method.indexOf('{');
  const header = method.slice(0, open + 1);
  const body = method.slice(open + 1, method.lastIndexOf('}')).replace(/^\n+|\n+$/g, '');
  return [
    header,
    ...frameSwitch(path).map((line) => `    ${line}`),
    '    try',
    '    {',
    ...body.split('\n').map((line) => (line ? `    ${line}` : line)),
    '    }',
    '    finally',
    '    {',
    '        driver.SwitchTo().DefaultContent();',
    '    }',
    '}',
  ].join('\n');
}

function methods(el: ModelElement): string[] {
  const n = el.name;
  const path = el.framePath ?? [];
  const framed = path.length > 0 && !isOpaque(path);

  // No element getter for a framed element: an IWebElement goes stale the
  // moment the driver switches away (SPEC §16).
  const elExpr = framed ? `driver.FindElement(${by(activeCandidate(el))})` : `Get${n}Element()`;
  const selectExpr = framed ? `new SelectElement(${elExpr})` : `Get${n}Select()`;

  const out: string[] = framed
    ? []
    : [`public IWebElement Get${n}Element()\n{\n    return driver.FindElement(${by(activeCandidate(el))});\n}`];

  switch (classify(el)) {
    case 'actionable':
      out.push(`public void Click${n}()\n{\n    ${elExpr}.Click();\n}`);
      break;

    case 'text':
      out.push(
        // GetDomProperty, not GetAttribute: the attribute is the INITIAL value
        // and does not change as the user types (Selenium 4.5+).
        `public string Get${n}()\n{\n    return ${elExpr}.GetDomProperty("value");\n}`,
        // One method, not Java's overload: C# has default arguments.
        `public void Set${n}(string value, bool clearFirst = true)\n{\n    IWebElement el = ${elExpr};\n    if (clearFirst)\n    {\n        el.Clear();\n    }\n    el.SendKeys(value);\n}`
      );
      break;

    case 'slider':
      out.push(
        `public string Get${n}()\n{\n    return ${elExpr}.GetDomProperty("value");\n}`,
        // The keyboard is the whole API a range offers, so these are it.
        `public void Increment${n}()\n{\n    ${elExpr}.SendKeys(Keys.Right);\n}`,
        `public void Decrement${n}()\n{\n    ${elExpr}.SendKeys(Keys.Left);\n}`,
        `public void Set${n}ToMin()\n{\n    ${elExpr}.SendKeys(Keys.Home);\n}`,
        `public void Set${n}ToMax()\n{\n    ${elExpr}.SendKeys(Keys.End);\n}`,
        // Steps from wherever it is, rather than resetting to min first: fewer
        // presses, and min and step never have to be read.
        `public void Set${n}(string value)\n{\n` +
          `    IWebElement el = ${elExpr};\n` +
          `    double target = double.Parse(value);\n` +
          `    double now = double.Parse(el.GetDomProperty("value"));\n` +
          `    while (now != target)\n` +
          `    {\n` +
          `        bool up = now < target;\n` +
          `        el.SendKeys(up ? Keys.Right : Keys.Left);\n` +
          `        double next = double.Parse(el.GetDomProperty("value"));\n` +
          `        // Clamped at an end, or stepped past a value this slider\n` +
          `        // cannot land on. Either way it goes no closer.\n` +
          `        if (next == now || (up ? next > target : next < target)) return;\n` +
          `        now = next;\n` +
          `    }\n}`
      );
      break;

    case 'toggle':
      // `isChecked`, not `checked` — `checked` is a C# keyword.
      out.push(
        `public bool Is${n}Checked()\n{\n    return ${elExpr}.Selected;\n}`,
        `public void Set${n}(bool isChecked)\n{\n    IWebElement el = ${elExpr};\n    if (el.Selected != isChecked)\n    {\n        el.Click();\n    }\n}`
      );
      break;

    case 'radio':
      out.push(
        `public bool Is${n}Selected()\n{\n    return ${elExpr}.Selected;\n}`,
        `public void Select${n}()\n{\n    IWebElement el = ${elExpr};\n    if (!el.Selected)\n    {\n        el.Click();\n    }\n}`
      );
      break;

    case 'select':
      out.push(
        ...(framed ? [] : [`public SelectElement ${selectExpr}\n{\n    return new SelectElement(${elExpr});\n}`]),
        `public string Get${n}Text()\n{\n    return ${selectExpr}.SelectedOption.Text;\n}`,
        `public string Get${n}Value()\n{\n    return ${selectExpr}.SelectedOption.GetDomProperty("value");\n}`,
        `public void Set${n}ByValue(string value)\n{\n    ${selectExpr}.SelectByValue(value);\n}`,
        `public void Set${n}ByText(string text)\n{\n    ${selectExpr}.SelectByText(text);\n}`
      );
      break;

    case 'multiSelect':
      out.push(
        ...(framed ? [] : [`public SelectElement ${selectExpr}\n{\n    return new SelectElement(${elExpr});\n}`]),
        `public IList<string> Get${n}Texts()\n{\n    return ${selectExpr}.AllSelectedOptions.Select(o => o.Text).ToList();\n}`,
        `public IList<string> Get${n}Values()\n{\n    return ${selectExpr}.AllSelectedOptions.Select(o => o.GetDomProperty("value")).ToList();\n}`,
        // DeselectAll first, or SelectByValue ADDS to the selection.
        `public void Set${n}ByValues(params string[] values)\n{\n    SelectElement el = ${selectExpr};\n    el.DeselectAll();\n    foreach (string value in values)\n    {\n        el.SelectByValue(value);\n    }\n}`,
        `public void Set${n}ByTexts(params string[] texts)\n{\n    SelectElement el = ${selectExpr};\n    el.DeselectAll();\n    foreach (string text in texts)\n    {\n        el.SelectByText(text);\n    }\n}`,
        `public void DeselectAll${n}()\n{\n    ${selectExpr}.DeselectAll();\n}`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? `public string Get${n}AltText()\n{\n    return ${elExpr}.GetDomAttribute("alt");\n}`
          : `public string Get${n}()\n{\n    return ${elExpr}.Text;\n}`
      );
      break;
  }

  return framed ? out.map((m) => (m.includes('driver.') ? inFrame(m, path) : m)) : out;
}

/** `By` fields to paste into your own page object. */
export function generateSeleniumCSharpLocators(model: TabModel): string {
  return model.elements
    .flatMap((el) => [...frameNote(el.framePath, '//', frameSwitch), `private readonly By ${underscoreCamel(el.name)} = ${by(activeCandidate(el))};`])
    .join('\n');
}

export function generateSeleniumCSharp(model: TabModel): string {
  return model.elements.map((el) => [banner(el), ...methods(el)].join('\n\n')).join('\n\n');
}

/** The methods with a class around them (SPEC §17). */
export function generateSeleniumCSharpPageObject(model: TabModel): string {
  const buckets = new Set(model.elements.map(classify));
  const usings = [
    ...(buckets.has('multiSelect') ? ['System.Collections.Generic', 'System.Linq'] : []),
    'OpenQA.Selenium',
    ...(buckets.has('select') || buckets.has('multiSelect') ? ['OpenQA.Selenium.Support.UI'] : []),
  ];
  const className = classNameOf(model);

  return [
    ...usings.map((u) => `using ${u};`),
    '',
    `public class ${className}`,
    '{',
    '    private readonly IWebDriver driver;',
    '',
    `    public ${className}(IWebDriver driver)`,
    '    {',
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
