import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Quasar ships single-word utility classes that are easy to collide with by
// accident. `class="row"` on a <tr> silently turned every table row into a flex
// container (`.row, .column, .flex { display: flex; flex-wrap: wrap }`), which
// stacked each cell onto its own line. Scoped styles do not protect against
// this — the collision is on the class name, not the CSS.
const RESERVED = ['row', 'column', 'flex', 'items-center', 'justify-between', 'absolute', 'relative', 'fixed', 'hidden'];

const UI_DIR = join(import.meta.dirname, '../../ui');

function classAttrs(source: string): string[] {
  return [...source.matchAll(/\bclass="([^"{}]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
}

describe('our templates do not collide with Quasar utility classes', () => {
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith('.vue'));

  it('finds the components to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(file, () => {
      const used = classAttrs(readFileSync(join(UI_DIR, file), 'utf8'));
      // Quasar's own q-* classes are fine; these bare words are not, unless we
      // actually want Quasar's utility behaviour.
      const collisions = used.filter((c) => RESERVED.includes(c));
      expect(collisions, `namespace these (e.g. pm-row) — they are Quasar utilities`).toEqual([]);
    });
  }
});
