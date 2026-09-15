// Framework → generated source (SPEC §11).
//
// Each framework offers one or more *shapes*: the same locators, arranged the
// way that framework's users arrange them. The first is the default.
//
// Every framework gets a "Locators only" shape. It is the escape hatch for the
// many teams with their own page-object conventions — our locators, none of our
// opinions — and it is the one output that is useful even when the surrounding
// structure is wrong for them.
import { frameworkById } from '../frameworks';
import type { TabModel } from '../model';
import { generatePlaywrightPageObject, generatePlaywrightLocators } from './playwright-ts';
import { generatePlaywrightPythonPageObject, generatePlaywrightPythonLocators } from './playwright-python';
import { generateSeleniumJava, generateSeleniumJavaLocators, generateSeleniumJavaPageObject } from './selenium-java';
import { generateSeleniumCSharp, generateSeleniumCSharpLocators, generateSeleniumCSharpPageObject } from './selenium-csharp';
import { generateSeleniumPython, generateSeleniumPythonLocators, generateSeleniumPythonPageObject } from './selenium-python';
import { generatePuppeteerPageObject, generatePuppeteerLocators } from './puppeteer';

export interface OutputShape {
  id: string;
  /** Shown in the code dialog's shape selector. */
  label: string;
  generate: (model: TabModel) => string;
}

// Shape ids are shared across frameworks on purpose — `locators` means the same
// thing everywhere, so the choice is about what you want, not about which
// framework's vocabulary you are in.
const pageObject = (generate: OutputShape['generate']): OutputShape => ({ id: 'page-object', label: 'Page object', generate });
const methods = (generate: OutputShape['generate']): OutputShape => ({ id: 'methods', label: 'Methods', generate });
const locators = (generate: OutputShape['generate']): OutputShape => ({ id: 'locators', label: 'Locators only', generate });

const SHAPES: Record<string, readonly OutputShape[]> = {
  'playwright-ts': [pageObject(generatePlaywrightPageObject), locators(generatePlaywrightLocators)],
  'playwright-python': [pageObject(generatePlaywrightPythonPageObject), locators(generatePlaywrightPythonLocators)],
  // Methods stays the default: it is what v2.5.1 produced, and the wrapper is
  // only useful once you have settled on a class per page.
  'selenium-java': [
    methods(generateSeleniumJava),
    pageObject(generateSeleniumJavaPageObject),
    locators(generateSeleniumJavaLocators),
  ],
  'selenium-csharp': [
    methods(generateSeleniumCSharp),
    pageObject(generateSeleniumCSharpPageObject),
    locators(generateSeleniumCSharpLocators),
  ],
  'selenium-python': [
    methods(generateSeleniumPython),
    pageObject(generateSeleniumPythonPageObject),
    locators(generateSeleniumPythonLocators),
  ],
  'puppeteer': [pageObject(generatePuppeteerPageObject), locators(generatePuppeteerLocators)],
};

/** The shapes a framework offers; empty when the framework is not generated yet. */
export function shapesFor(frameworkId: string): readonly OutputShape[] {
  return SHAPES[frameworkId] ?? [];
}

export function canGenerate(frameworkId: string): boolean {
  return shapesFor(frameworkId).length > 0;
}

/**
 * `shapeId` defaults to the framework's first shape. `className` overrides the
 * one derived from the URL, which is a guess — `/checkout/step2` yields
 * `Step2Page` — and only ever appears in generated code, so correcting it
 * afterwards means correcting it again on every regeneration (SPEC §12).
 */
export function generateCode(model: TabModel, shapeId?: string, className?: string): string {
  const shapes = shapesFor(model.frameworkId);
  if (shapes.length === 0) {
    // Better to say which target is missing than to show an empty dialog.
    const done = Object.keys(SHAPES).map((id) => frameworkById(id).label).join(', ');
    return `// ${frameworkById(model.frameworkId).label} is not generated yet.\n// Available so far: ${done}.`;
  }
  const shape = shapes.find((s) => s.id === shapeId) ?? shapes[0];
  return shape.generate(className?.trim() ? { ...model, className: className.trim() } : model);
}
