// Framework → generated source (SPEC §11).
//
// Only Selenium Java so far — the reference template. The others are additive:
// one file each, all consuming the same model.
import { frameworkById } from '../frameworks';
import type { TabModel } from '../model';
import { generateSeleniumJava } from './selenium-java';

type Generator = (model: TabModel) => string;

const GENERATORS: Record<string, Generator> = {
  'selenium-java': generateSeleniumJava,
};

export function canGenerate(frameworkId: string): boolean {
  return frameworkId in GENERATORS;
}

export function generateCode(model: TabModel): string {
  const generate = GENERATORS[model.frameworkId];
  if (generate) return generate(model);
  // Better to say which target is missing than to show an empty dialog.
  return `// ${frameworkById(model.frameworkId).label} is not generated yet.\n// Selenium WebDriver Java is the only target so far.`;
}
