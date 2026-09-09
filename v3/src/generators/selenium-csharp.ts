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
import { classNameFor } from './class-name';
import { frameNote } from '../locators/frames';

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

function banner(el: ModelElement): string {
  // The frame chain goes in the banner, where a reader is already looking to
  // see what this block is about (SPEC §16).
  const frames = frameNote(el.framePath, 'line').map((line) => ` * ${line.replace(/^\/\/ /, '')}`);
  return [`/*`, ` * ${el.name}`, ...frames, ` * ***************************************************************`, ` */`].join('\n');
}

function methods(el: ModelElement): string[] {
  const n = el.name;
  const out: string[] = [
    `public IWebElement Get${n}Element()\n{\n    return driver.FindElement(${by(activeCandidate(el))});\n}`,
  ];

  switch (classify(el)) {
    case 'actionable':
      out.push(`public void Click${n}()\n{\n    Get${n}Element().Click();\n}`);
      break;

    case 'text':
      out.push(
        // GetDomProperty, not GetAttribute: the attribute is the INITIAL value
        // and does not change as the user types (Selenium 4.5+).
        `public string Get${n}()\n{\n    return Get${n}Element().GetDomProperty("value");\n}`,
        // One method, not Java's overload: C# has default arguments.
        `public void Set${n}(string value, bool clearFirst = true)\n{\n    IWebElement el = Get${n}Element();\n    if (clearFirst)\n    {\n        el.Clear();\n    }\n    el.SendKeys(value);\n}`
      );
      break;

    case 'toggle':
      // `isChecked`, not `checked` — `checked` is a C# keyword.
      out.push(
        `public bool Is${n}Checked()\n{\n    return Get${n}Element().Selected;\n}`,
        `public void Set${n}(bool isChecked)\n{\n    IWebElement el = Get${n}Element();\n    if (el.Selected != isChecked)\n    {\n        el.Click();\n    }\n}`
      );
      break;

    case 'radio':
      out.push(
        `public bool Is${n}Selected()\n{\n    return Get${n}Element().Selected;\n}`,
        `public void Select${n}()\n{\n    IWebElement el = Get${n}Element();\n    if (!el.Selected)\n    {\n        el.Click();\n    }\n}`
      );
      break;

    case 'select':
      out.push(
        `public SelectElement Get${n}Select()\n{\n    return new SelectElement(Get${n}Element());\n}`,
        `public string Get${n}Text()\n{\n    return Get${n}Select().SelectedOption.Text;\n}`,
        `public string Get${n}Value()\n{\n    return Get${n}Select().SelectedOption.GetDomProperty("value");\n}`,
        `public void Set${n}ByValue(string value)\n{\n    Get${n}Select().SelectByValue(value);\n}`,
        `public void Set${n}ByText(string text)\n{\n    Get${n}Select().SelectByText(text);\n}`
      );
      break;

    case 'multiSelect':
      out.push(
        `public SelectElement Get${n}Select()\n{\n    return new SelectElement(Get${n}Element());\n}`,
        `public IList<string> Get${n}Texts()\n{\n    return Get${n}Select().AllSelectedOptions.Select(o => o.Text).ToList();\n}`,
        `public IList<string> Get${n}Values()\n{\n    return Get${n}Select().AllSelectedOptions.Select(o => o.GetDomProperty("value")).ToList();\n}`,
        // DeselectAll first, or SelectByValue ADDS to the selection.
        `public void Set${n}ByValues(params string[] values)\n{\n    SelectElement el = Get${n}Select();\n    el.DeselectAll();\n    foreach (string value in values)\n    {\n        el.SelectByValue(value);\n    }\n}`,
        `public void Set${n}ByTexts(params string[] texts)\n{\n    SelectElement el = Get${n}Select();\n    el.DeselectAll();\n    foreach (string text in texts)\n    {\n        el.SelectByText(text);\n    }\n}`,
        `public void DeselectAll${n}()\n{\n    Get${n}Select().DeselectAll();\n}`
      );
      break;

    case 'static':
      out.push(
        isImage(el)
          ? `public string Get${n}AltText()\n{\n    return Get${n}Element().GetDomAttribute("alt");\n}`
          : `public string Get${n}()\n{\n    return Get${n}Element().Text;\n}`
      );
      break;
  }

  return out;
}

/** `By` fields to paste into your own page object. */
export function generateSeleniumCSharpLocators(model: TabModel): string {
  return model.elements
    .flatMap((el) => [...frameNote(el.framePath, 'line'), `private readonly By ${underscoreCamel(el.name)} = ${by(activeCandidate(el))};`])
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
  const className = classNameFor(model.url);

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
