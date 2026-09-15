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
const HOST_DIR = join(import.meta.dirname, '../../host');

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
  /** Comments explain the rule; they are not calls. */
  const code = (path: string) =>
    readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

  const uses = (path: string) => /browser\s*\.\s*tabs/.test(code(path));

  // Everything a DevTools panel loads. `ui/` was scanned and `host/` was not,
  // which left the one file whose entire job is to be the DevTools adapter
  // outside the guard the rule exists for.
  const panelFiles = [
    ...readdirSync(UI_DIR)
      .filter((f) => f.endsWith('.vue') || f.endsWith('.ts'))
      .map((f) => join(UI_DIR, f)),
    ...readdirSync(HOST_DIR)
      .filter((f) => f.endsWith('.ts') && f !== 'sidepanel.ts')
      .map((f) => join(HOST_DIR, f)),
  ];

  for (const path of panelFiles) {
    it(path.split('/').slice(-2).join('/'), () => {
      expect(uses(path), 'use send() / RELAY_TO_TAB — browser.tabs is undefined in a DevTools panel').toBe(false);
    });
  }

  it('exempts the side panel host, which is the one surface that may', () => {
    // A side panel is not a devtools page: it follows the active tab and has
    // no other way to know which one that is. Asserted rather than merely
    // skipped, so the exemption cannot quietly become dead — a rename would
    // fail here instead of silently dropping a file out of the scan above.
    expect(uses(join(HOST_DIR, 'sidepanel.ts')), 'sidepanel.ts is the exemption this list is written around').toBe(
      true
    );
  });
});
