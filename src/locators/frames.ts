// How a frame path reads in each target (SPEC §16).
//
// The split that matters: Playwright can carry the chain inside the locator, so
// its output stays self-contained. Selenium and Puppeteer cannot — a `By` is
// frame-agnostic and `page.locator` is page-scoped — so their output has to say
// out loud that a switch is required first, or it silently addresses the wrong
// document.
import type { FrameStep } from '../engine/types';
import { singleQuoted, doubleQuoted } from '../quote';
import { puppeteerShadowSelector } from './shadow';

/**
 * The selector string for one step, in PLAYWRIGHT's spelling.
 *
 * Puppeteer's xpath prefix is `xpath/`, not `xpath=`, so it needs its own —
 * see `puppeteerFrameSelector`. Passing this one to `page.$()` produced a
 * selector Puppeteer parses as CSS and rejects, in a comment whose whole
 * purpose is to carry a line the reader pastes (SPEC §16).
 */
export function frameSelector(step: FrameStep): string {
  return step.frame.kind === 'xpath' ? `xpath=${step.frame.value}` : (step.frame as { value: string }).value;
}

/**
 * The same step for Puppeteer, whose xpath prefix is `xpath/`.
 *
 * Host chain included, via `>>>`. Puppeteer's plain css does NOT pierce — that
 * is the whole reason `>>>` exists (SPEC §19) — so a frame rendered by a web
 * component was addressed with a selector that resolves to null, and
 * `(await page.$(sel)).contentFrame()` then throws on the null rather than
 * merely finding the wrong thing.
 *
 * Not applied to an xpath step: `xpath/` and `>>>` are different engines and
 * do not compose. A frame inside a shadow root is located by css anyway —
 * `frameStepFor` ranks within the frame's own root, where xpath resolves
 * nothing at all.
 */
export function puppeteerFrameSelector(step: FrameStep): string {
  if (step.frame.kind === 'xpath') return `xpath/${step.frame.value}`;
  return puppeteerShadowSelector(step.shadowPath, (step.frame as { value: string }).value);
}

/**
 * Paths are optional throughout because a model can outlive the version that
 * wrote it: `storage.session` survives an extension reload, so elements
 * captured before frame support existed still arrive without one.
 */
type Path = FrameStep[] | undefined;

/** True when the chain is incomplete because a document in it is cross-origin. */
export const isOpaque = (path: Path) => (path ?? []).some((s) => s.opaque);

/** `frameLocator('#a').frameLocator('#b').`, or '' for the main frame. */
export function playwrightFramePrefix(path: Path): string {
  return (path ?? []).map((s) => `frameLocator(${singleQuoted(frameSelector(s))}).`).join('');
}

/** The Python spelling of the same chain. */
export function playwrightPyFramePrefix(path: Path): string {
  return (path ?? []).map((s) => `frame_locator(${doubleQuoted(frameSelector(s))}).`).join('');
}

/** How a step reads to a person: no Playwright `xpath=` prefix in prose. */
export function describeStep(step: FrameStep): string {
  if (step.opaque) return 'a cross-origin frame';
  return step.frame.kind === 'xpath' ? `xpath ${step.frame.value}` : (step.frame as { value: string }).value;
}

/**
 * The comment that has to accompany a frame-bound locator in a target that
 * cannot express the chain. Without it the locator looks like every other one
 * and quietly resolves against the wrong document.
 *
 * It carries the switch itself, commented out, rather than an instruction to
 * go and write one: the reader can paste it. `switchTo` is supplied by the
 * generator, so each language spells its own API and its own `By`.
 */
/**
 * Just where the element is. For shapes whose methods switch for themselves —
 * repeating the switch in the banner is noise the reader has to check against
 * the code below it.
 */
export function frameContext(path: Path, comment: string): string[] {
  if (!path || path.length === 0) return [];
  const lines = [`In frame: ${path.map(describeStep).join(' \u203a ')}`];
  if (isOpaque(path)) lines.push('A frame above this one is cross-origin: switch into it yourself first.');
  return lines.map((line) => `${comment} ${line}`);
}

export function frameNote(path: Path, comment: string, switchTo: (path: FrameStep[]) => string[]): string[] {
  if (!path || path.length === 0) return [];
  const lines = [`In frame: ${path.map(describeStep).join(' \u203a ')}`];
  if (isOpaque(path)) {
    // Half a chain is worse than none: pasting it would switch into the wrong
    // document and look like it worked.
    lines.push('A frame above this one is cross-origin, so the chain is incomplete.');
  } else {
    lines.push(...switchTo(path));
  }
  return lines.map((line) => `${comment} ${line}`);
}
