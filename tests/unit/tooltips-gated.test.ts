import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// "Show tooltips" is a setting (SPEC §14), and a tooltip that ignores it is
// not a tooltip the user can turn off. Nine of ten honoured it; the tenth,
// in the Edit dialog, was simply forgotten — and nothing would have noticed,
// because a tooltip only appears on hover and only when someone looks.
//
// Scanned rather than tested per component, for the same reason the browser.tabs
// check is scanned: the next tooltip somebody adds is the one that matters.
const UI_DIR = join(import.meta.dirname, '../../ui');

describe('every tooltip', () => {
  it('is gated on the showTooltips setting', () => {
    const ungated: string[] = [];

    for (const file of readdirSync(UI_DIR).filter((f) => f.endsWith('.vue'))) {
      const source = readFileSync(join(UI_DIR, file), 'utf8');
      for (const tag of source.match(/<q-tooltip[^>]*>/g) ?? []) {
        if (!tag.includes('v-if="showTooltips"')) ungated.push(`${file}: ${tag}`);
      }
    }

    expect(ungated, 'add v-if="showTooltips", and the prop if the component lacks it').toEqual([]);
  });

  it('finds the tooltips it is meant to be checking', () => {
    // A scan that matches nothing passes for the wrong reason.
    const total = readdirSync(UI_DIR)
      .filter((f) => f.endsWith('.vue'))
      .reduce((n, f) => n + (readFileSync(join(UI_DIR, f), 'utf8').match(/<q-tooltip/g) ?? []).length, 0);
    expect(total).toBeGreaterThan(5);
  });
});
