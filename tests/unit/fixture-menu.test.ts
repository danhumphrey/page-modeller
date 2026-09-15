import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

// `shadow.html` existed for its whole life without appearing in the fixture
// menu or in what `npm run fixtures` prints, because both were written down by
// hand. An unlisted fixture is one nobody opens, and for a fixture that is the
// same as not having it — these pages exist precisely to be hand-tested
// against (CLAUDE.md: manual testing is the completion gate).

const DIR = join(import.meta.dirname, '../fixtures');
const html = (file: string) => readFileSync(join(DIR, file), 'utf8');

/** Pages another fixture embeds as a frame: reachable, but not destinations. */
function embedded(): Set<string> {
  const out = new Set<string>();
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.html'))) {
    for (const [, src] of html(file).matchAll(/<(?:iframe|frame)\b[^>]*\ssrc="([^"]+)"/gi)) {
      out.add(basename(src.split('?')[0]));
    }
  }
  return out;
}

const MENU = readdirSync(DIR)
  .filter((f) => f.endsWith('.html'))
  .filter((f) => !embedded().has(f))
  .sort();

describe('the fixture menu', () => {
  it('has the pages we think it has', () => {
    // Guards the derivation itself: if the embed detection broke, every test
    // below would pass against a menu of one.
    expect(MENU).toEqual([
      'ambiguous.html',
      'edgecases.html',
      'frames.html',
      'frameset.html',
      'login.html',
      'shadow.html',
      'widgets.html',
    ]);
  });

  for (const page of MENU) {
    // frameset.html is a <frameset> document: it has no body, so it cannot
    // carry a nav. It is still a destination, so other pages must link to it.
    const carriesNav = !html(page).includes('<frameset');

    it(`${page} links to every other fixture`, () => {
      if (!carriesNav) return;
      const source = html(page);
      expect(source, 'carries the fixture nav at all').toContain('fixtures:');

      for (const other of MENU) {
        if (other === page) {
          // Its own entry is the emphasised one, not a link.
          expect(source, `${page} marks itself`).toMatch(
            new RegExp(`<strong>${other.replace('.html', '')}</strong>`)
          );
        } else {
          expect(source, `${page} → ${other}`).toContain(`href="${other}"`);
        }
      }
    });
  }
});
