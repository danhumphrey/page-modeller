# Page Modeller (Phase 1)

Pick a DOM element (DevTools-style) and generate a **verified Playwright Page Object Model**, built on
the stack validated in the feasibility study (WXT + Vue 3 + Quasar + TypeScript, no LLM).

## What's here (Phase 1 scope)

- **Locator engine** (`src/engine/`) — computes ranked, verified locator candidates (`getByRole`,
  `getByLabel`, … → CSS/XPath fallback) via `dom-accessibility-api`. Validated against real Playwright
  resolution (see the fidelity test).
- **Locator IR** (`src/engine/types.ts`) — framework-agnostic candidate list; the contract for generators.
- **Playwright-TS generator** (`src/generators/`) — pure `IR → Page Object source` function.
- **Inspector overlay** (`entrypoints/content/`) — highlight + click to pick; runs in all frames.
- **Side panel** (`entrypoints/sidepanel/`) — Quasar UI: pick, choose among ranked candidates, live code
  preview, copy.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | WXT dev server (HMR) |
| `npm run build` / `build:firefox` | Production build (`.output/`) |
| `npm run zip` | Store-ready zips (incl. Firefox sources zip) |
| `npm run typecheck` | Strict TS check of the pure core |
| `npm run test:unit` | Vitest — generator + naming |
| `npm test` | Unit + engine fidelity (real Playwright) + extension E2E |

## Load it

`npm run build`, then load `.output/chrome-mv3` at `chrome://extensions` (Developer mode → Load unpacked).
Click the toolbar icon to open the side panel.

## Known Phase-1 limits (next steps)

- **Main-frame picking** — the content script runs in all frames, but cross-origin **frame-path
  assembly** (IR `framePath`) is not wired into the UI yet (proven feasible in the study's Spike #5).
- Single generator (Playwright-TS). Selenium/Puppeteer/Playwright-Python generators are additive
  (one file each) thanks to the IR.
- Content script applies to pages loaded after install; already-open tabs need a reload.
