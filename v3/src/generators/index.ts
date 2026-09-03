import type { Generator, TargetFramework } from './types';
import { playwrightTs } from './playwright-ts';

export const generators: Record<TargetFramework, Generator> = {
  'playwright-ts': playwrightTs,
};

export const defaultGenerator: TargetFramework = 'playwright-ts';
export * from './types';
