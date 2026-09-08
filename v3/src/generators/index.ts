// Framework → generated source (SPEC §11).
//
// Only Selenium Java so far — the reference template. The others are additive:
// one file each, all consuming the same model.
import { frameworkById } from '../frameworks';
import type { TabModel } from '../model';
import { generatePlaywrightTs } from './playwright-ts';
import { generateSeleniumJava } from './selenium-java';

type Generator = (model: TabModel) => string;

const GENERATORS: Record<string, Generator> = {
  'playwright-ts': generatePlaywrightTs,
  'selenium-java': generateSeleniumJava,
};

export function canGenerate(frameworkId: string): boolean {
  return frameworkId in GENERATORS;
}

export function generateCode(model: TabModel): string {
  const generate = GENERATORS[model.frameworkId];
  if (generate) return generate(model);
  // Better to say which target is missing than to show an empty dialog.
  const done = Object.keys(GENERATORS).map((id) => frameworkById(id).label).join(', ');
  return `// ${frameworkById(model.frameworkId).label} is not generated yet.\n// Available so far: ${done}.`;
}
