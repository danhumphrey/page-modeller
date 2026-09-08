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


// `browser.tabs` is undefined in a Firefox DevTools panel — a devtools page is
// granted only devtools.*, runtime.* and a few others. Chrome tolerates the
// call, so a regression here is invisible on Chrome and on every automated test
// we can run. The panel must go through the background relay instead.
describe('the panel never touches browser.tabs directly', () => {
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith('.vue') || f.endsWith('.ts'));

  for (const file of files) {
    it(file, () => {
      const source = readFileSync(join(UI_DIR, file), 'utf8')
        // Comments explain the rule; they are not calls.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(source, 'use send() / RELAY_TO_TAB — browser.tabs is undefined in a DevTools panel').not.toMatch(
        /browser\s*\.\s*tabs/
      );
    });
  }
});
