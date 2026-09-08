import { describe, it, expect } from 'vitest';
import { chooseCandidate } from '../../src/locators/select';
import { frameworks } from '../../src/frameworks';
import type { RankedCandidate } from '../../src/engine/types';

/** A heading picked on a page — the case that exposed this. */
const candidates: RankedCandidate[] = [
  { candidate: { kind: 'role', role: 'heading', name: 'Google', exact: true }, predictedCount: 1 },
  { candidate: { kind: 'text', text: 'Google', exact: true }, predictedCount: 1 },
  { candidate: { kind: 'id', value: 'hplogo' }, predictedCount: 1 },
  { candidate: { kind: 'className', value: 'logo' }, predictedCount: 2 },
  { candidate: { kind: 'tagName', value: 'h1' }, predictedCount: 3 },
  { candidate: { kind: 'css', value: 'h1#hplogo' }, predictedCount: 1 },
  { candidate: { kind: 'xpath', value: '/html[1]/body[1]/h1[1]' }, predictedCount: 1 },
];

const kindFor = (frameworkId: string) => candidates[chooseCandidate(candidates, frameworkId)].candidate.kind;

describe('chooseCandidate', () => {
  it('prefers role for Playwright', () => {
    expect(kindFor('playwright-ts')).toBe('role');
  });

  it('never picks a Playwright-only strategy for Selenium', () => {
    // The bug: a Selenium model selected getByRole, displayed it as
    // "role: heading — Google", and the eye certified it.
    expect(kindFor('selenium-java')).toBe('id');
  });

  it('never picks a Playwright-only strategy for Puppeteer', () => {
    // Puppeteer has only css and xpath.
    expect(kindFor('puppeteer')).toBe('css');
  });

  it('chooses something expressible for every framework', () => {
    for (const f of frameworks) {
      const chosen = candidates[chooseCandidate(candidates, f.id)].candidate.kind;
      expect(f.locatorTypes, `${f.label} chose ${chosen}`).toContain(chosen);
    }
  });

  it('follows the framework order, not the generation order', () => {
    // id outranks css in Selenium's list even though css appears later here and
    // both resolve uniquely.
    expect(kindFor('selenium-python')).toBe('id');
  });

  it('prefers a unique candidate over an earlier ambiguous one', () => {
    const ambiguous: RankedCandidate[] = [
      { candidate: { kind: 'id', value: 'dup' }, predictedCount: 3 },
      { candidate: { kind: 'css', value: '#dup.first' }, predictedCount: 1 },
    ];
    expect(ambiguous[chooseCandidate(ambiguous, 'selenium-java')].candidate.kind).toBe('css');
  });

  it('falls back to an expressible candidate when none is unique', () => {
    const none: RankedCandidate[] = [
      { candidate: { kind: 'role', role: 'button' }, predictedCount: 4 },
      { candidate: { kind: 'tagName', value: 'button' }, predictedCount: 9 },
    ];
    expect(none[chooseCandidate(none, 'selenium-java')].candidate.kind).toBe('tagName');
  });
});
