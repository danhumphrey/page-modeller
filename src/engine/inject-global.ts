import { generate, shadowPathOf, shadowSelector } from './candidates';
import { collectInteractive, collectClosedHosts } from './interactive';

// Test-only entry: exposes the engine on window.__spike so the fidelity harness
// can inject it into a page and call it. Not part of the shipped extension.
//
// The scan-side functions are here too because shadow DOM (SPEC §19) is the
// first behaviour where what a SCAN collects differs from what `generate`
// produces for one element, and it can only be checked in a real browser —
// jsdom is not where a web component's rendering is decided.
(
  window as unknown as {
    __spike: {
      generate: typeof generate;
      shadowPathOf: typeof shadowPathOf;
      shadowSelector: typeof shadowSelector;
      collectInteractive: typeof collectInteractive;
      collectClosedHosts: typeof collectClosedHosts;
    };
  }
).__spike = { generate, shadowPathOf, shadowSelector, collectInteractive, collectClosedHosts };
