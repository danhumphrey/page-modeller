import { generate } from './candidates';

// Test-only entry: exposes the engine on window.__spike so the fidelity harness
// can inject it into a page and call it. Not part of the shipped extension.
(window as unknown as { __spike: { generate: typeof generate } }).__spike = { generate };
