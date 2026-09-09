// How a frame path reads in each target (SPEC §16).
//
// The split that matters: Playwright can carry the chain inside the locator, so
// its output stays self-contained. Selenium and Puppeteer cannot — a `By` is
// frame-agnostic and `page.locator` is page-scoped — so their output has to say
// out loud that a switch is required first, or it silently addresses the wrong
// document.
import type { FrameStep } from '../engine/types';
import { singleQuoted, doubleQuoted } from '../quote';

/** The selector string for one step; every frame API in reach takes one. */
export function frameSelector(step: FrameStep): string {
  return step.frame.kind === 'xpath' ? `xpath=${step.frame.value}` : (step.frame as { value: string }).value;
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

/**
 * The note that has to accompany a frame-bound locator in a target that cannot
 * express the chain. Without it the locator looks like every other one and
 * quietly resolves against the wrong document.
 */
export function frameNote(path: Path, style: 'line' | 'hash'): string[] {
  if (!path || path.length === 0) return [];
  const mark = style === 'hash' ? '#' : '//';
  const chain = path.map((s) => frameSelector(s)).join(' › ');
  const lines = [`${mark} In frame: ${chain}`, `${mark} Switch to it before using this locator.`];
  if (isOpaque(path)) {
    lines.push(`${mark} The chain is incomplete: a frame above this one is cross-origin.`);
  }
  return lines;
}
