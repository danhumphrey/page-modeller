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
import { generateSeleniumJava, generateSeleniumJavaLocators } from './selenium-java';

export interface OutputShape {
  id: string;
  /** Shown in the code dialog's shape selector. */
  label: string;
  generate: (model: TabModel) => string;
}

const SHAPES: Record<string, readonly OutputShape[]> = {
  'playwright-ts': [
    { id: 'page-object', label: 'Page object', generate: generatePlaywrightPageObject },
    { id: 'locators', label: 'Locators only', generate: generatePlaywrightLocators },
  ],
  'selenium-java': [
    { id: 'methods', label: 'Methods', generate: generateSeleniumJava },
    { id: 'locators', label: 'Locators only', generate: generateSeleniumJavaLocators },
  ],
};

/** The shapes a framework offers; empty when the framework is not generated yet. */
export function shapesFor(frameworkId: string): readonly OutputShape[] {
  return SHAPES[frameworkId] ?? [];
}

export function canGenerate(frameworkId: string): boolean {
  return shapesFor(frameworkId).length > 0;
}

/** `shapeId` defaults to the framework's first shape. */
export function generateCode(model: TabModel, shapeId?: string): string {
  const shapes = shapesFor(model.frameworkId);
  if (shapes.length === 0) {
    // Better to say which target is missing than to show an empty dialog.
    const done = Object.keys(SHAPES).map((id) => frameworkById(id).label).join(', ');
    return `// ${frameworkById(model.frameworkId).label} is not generated yet.\n// Available so far: ${done}.`;
  }
  const shape = shapes.find((s) => s.id === shapeId) ?? shapes[0];
  return shape.generate(model);
}
