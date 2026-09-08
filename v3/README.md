# Page Modeller (Phase 1)

Pick a DOM element (DevTools-style) and generate a **verified Playwright Page Object Model**, built on
the stack validated in the feasibility study (WXT + Vue 3 + Quasar + TypeScript, no LLM).

## What's here (Phase 1 scope)

- **Locator engine** (`src/engine/`) — computes ranked, verified locator candidates (`getByRole`,
  `getByLabel`, … → CSS/XPath fallback) via `dom-accessibility-api`. Validated against real Playwright
  resolution (see the fidelity test).
- **Locator IR** (`src/engine/types.ts`) — framework-agnostic candidate list; the contract for generators.
- **Inspector overlay** (`entrypoints/content/`) — highlight + click to pick; runs in all frames.
- **Panel UI** (`ui/`) — Quasar: `AppToolbar` (SPEC §3) over `ModelTable` (SPEC §6). One app, three
  surfaces. Shell only so far — capture, generation and the dialogs are the next increments.
- **Frameworks** (`src/frameworks.ts`) — the targets and the locator types each can express (SPEC §7).
- **Host adapter** (`host/`) — the only thing that differs per surface: which tab the panel drives.
  Side panel / sidebar follow the active tab (`tabs.query`); a DevTools panel is pinned to the tab it
  was opened on (`devtools.inspectedWindow.tabId`).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `dev:firefox` | WXT dev server (HMR); launches the browser with the extension loaded |
| `npm run fixtures` | Optional — serve `tests/fixtures/` at `http://localhost:5199` |
| `npm run build` / `build:firefox` | Production build (`.output/`) |
| `npm run zip` | Store-ready zips (incl. Firefox sources zip) |
| `npm run typecheck` | Strict TS check of the pure core |
| `npm run test:unit` | Vitest — pure core |
| `npm run check:manifests` | Assert both builds emit the expected surfaces |
| `npm test` | Unit + engine fidelity (real Playwright) + both builds + manifests + extension E2E |

## Surfaces

MV3 on both browsers. One `sidepanel` entrypoint gives Chrome `side_panel` and Firefox `sidebar_action`;
`devtools.html` registers the panel on both.

| | Chrome | Firefox |
|---|---|---|
| Side panel / sidebar | toolbar icon | toolbar icon (or View → Sidebar → Page Modeller) |
| DevTools panel | F12 → **Page Modeller** | F12 → **Page Modeller** |

## Load it

`npm run dev` (Chrome) or `npm run dev:firefox` — WXT launches the browser with the extension loaded.
Navigate wherever you want to test.

Manually, from a production build:

- **Chrome** — `npm run build`, then `chrome://extensions` → Developer mode → Load unpacked →
  `.output/chrome-mv3`.
- **Firefox** — `npm run build:firefox`, then `about:debugging#/runtime/this-firefox` → Load Temporary
  Add-on → `.output/firefox-mv3/manifest.json`.

## Manual verification

Automated tests are a net; this is the gate. Per increment, on **both** browsers:

1. Extension loads with no console errors (check the background/service-worker console too).
2. Open the side panel / sidebar **and** the DevTools panel. Both render, and the header chip names the
   surface you're on.
3. Toolbar reads Scan · Delete Model · framework · Add Element · Generate Code, with Delete Model and
   Generate Code visibly disabled while the model is empty (SPEC §3).
4. The framework selector opens and lists all six targets; picking one updates the label.
5. Table shows Name · Locator · Actions and the empty state, with all three headers visible at the
   narrowest side-panel width.
6. Tooltips appear on every toolbar button.

`npm run fixtures` serves `tests/fixtures/` over http if you want to pick against the four pages the
engine was validated on — expected locators are tabulated in `docs/v3/spikes/SPIKE-RESULTS.md`, so a
mismatch there is a real signal. Optional; the fidelity spec covers them automatically. They're bare
markup, so the failures that matter — overlays, sticky headers, shadow roots, frames — only show up on
real sites.

## Where this is up to

Behaviour is owned by [`../docs/v3/SPEC.md`](../docs/v3/SPEC.md); the build order is `REWRITE-PLAN.md`
§12. Built so far: the host-agnostic shell, and the toolbar + table shell. **No capture yet** — the
toolbar buttons acknowledge and do nothing, so the table only ever shows its empty state until Add
Element lands.

- Content script applies to pages loaded after install; already-open tabs need a reload.
- `browser_specific_settings.gecko.id` is a **placeholder**. The real AMO id must replace it before any
  upload, or Firefox gets a second listing instead of an update (NFR-6).
- Firefox MV3 treats `host_permissions` as optional — if picking doesn't work there, check the
  extension's permissions in `about:addons`.
