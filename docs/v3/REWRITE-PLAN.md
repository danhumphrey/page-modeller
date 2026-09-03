# Page Modeller — Rewrite Architecture & Feasibility Plan

> Feasibility study for a ground-up rewrite of [page-modeller](https://github.com/danhumphrey/page-modeller)
> as a modern TypeScript / Vue 3 / Quasar cross-browser WebExtension with first-class Playwright support.

---

## 1. Verdict

> **Feasibility study complete — GO.** All four de-risking spikes passed (§9): a11y locator fidelity
> (43/43 vs real Playwright, 0 divergences), cross-origin frame assembly (6/6), UI stack (WXT+Vue+Quasar
> builds & renders on Chrome+Firefox), and verification performance (~14ms/pick at ~11.7k elements). The
> vendor-Playwright's-engine question was measured and answered (no — §14). Extension E2E is also proven
> — Playwright drives the built extension under headless CI (§15) — and the full build/package/multi-store
> release path is scriptable via WXT (§16). Remaining work (#3 runtime parity, naming polish) is
> engineering, not feasibility. Four runnable harnesses back these results.

A rewrite is feasible and worthwhile. The hard, valuable part of the existing tool — **computing and
verifying locators in-page** — is sound and worth carrying forward. What's dated is the *platform*
(JavaScript, Sizzle, Vuetify, old build tooling) and the *coverage gap* (no modern Playwright
accessibility locators).

**An on-device LLM is explicitly out of the critical path.** Accessibility locators (`getByRole`,
`getByLabel`, etc.) are *deterministically computable* from published specs — Playwright's own codegen
does this with no model. An LLM would be slower, non-reproducible, hardware/version-gated, and would
amputate Firefox support. It is reserved, at most, as an optional semantic-naming enhancement (§10).

The genuine feasibility risk is **not** "can we generate the code" — it's **"how faithfully can we
reproduce Playwright's accessible-name/role computation in a content script, across the browsers we
support?"** That is the thing to de-risk first (§9).

---

## 2. Goals & Non-Goals

### Goals
- Pick a DOM element (DevTools-style inspector) and generate a verified, framework-agnostic locator.
- **Strong, first-class Playwright support** with modern accessibility locators.
- Generate Page Object Models for: **Playwright (TS/JS)**, **Playwright (Python)**,
  **Selenium 4 (Java/C#)**, **Puppeteer**.
- Preserve **cross-browser** support (Chrome + Firefox + Chromium family).
- **Frame / iframe support, including cross-origin** — model elements inside nested frames
  (the original tool did not). See §13.
- Modern stack: **TypeScript (strict)**, **Vue 3**, **Quasar**, Vite-based tooling, MV3.
- Reuse existing locator/naming logic where it still holds up; redesign where it doesn't.

### Non-Goals (this rewrite)
- Robot Framework and Protractor generators (**dropped** — Protractor is EOL).
- LLM as a core dependency.
- Full user-flow / action *recording* (single-element modelling is the scope, as today).
- **In-browser action replay** — interesting (validate a modelled flow live before export), but
  **deferred**; revisit after the core rewrite. Carries a trusted-event caveat (synthetic in-page
  events are `isTrusted:false` and are a preview, not a substitute for the exported code).

---

## 3. Recommended Stack

| Concern | Choice | Rationale / Risk |
|---|---|---|
| Extension framework | **WXT** | Vite-based, TS-first, purpose-built for cross-browser MV3. Generates per-browser manifests, gives HMR for content/background/UI. Replaces the bespoke Webpack setup. |
| Language | **TypeScript (strict)** | Replaces JS; the locator IR and generators benefit enormously from types. |
| UI framework | **Vue 3 (`<script setup>`)** | Carry over Vue knowledge; modern Composition API. |
| Component library | **Quasar via `@quasar/vite-plugin`** | Replaces Vuetify. ✅ **Validated (Spike #2)** — builds for Chrome + Firefox and renders correctly; recipe: drive Vite directly with `vue()` + `quasar()` plugins, pass `transformAssetUrls`, import `quasar/src/css/index.sass` (+ `sass-embedded`). See `spikes/SPIKE2-RESULTS.md`. |
| State | **Pinia** | Standard Vue 3 store. |
| A11y computation | **`dom-accessibility-api` + `aria-query`** | The accname/role implementations Testing Library uses. This is what makes Playwright locators possible without an LLM. |
| Selector engines | **Native `querySelectorAll` + `document.evaluate`** | **Drop Sizzle entirely** — obsolete; native CSS/XPath is universal now. |
| Unit tests | **Vitest** | Fast, Vite-native; port existing `xpath`/`dom` tests. |
| E2E (the extension itself) | **Playwright** | Drives a real browser with the extension loaded. |
| Lint/format | **ESLint (flat) + Prettier** | Modern config. |

---

## 4. Architecture Overview

Three runtime surfaces, one shared core. The UI is built **host-agnostic** (per your "decide later"
choice): the same Vue app mounts inside whichever host the browser/build targets.

```
┌─────────────────────────────────────────────────────────────┐
│  UI host (host-agnostic Vue 3 + Quasar app)                   │
│  • DevTools panel page   (Chrome + Firefox)                   │
│  • Side panel page       (Chromium)  ─┐ chosen per-build      │
│  • Sidebar page          (Firefox)   ─┘ via WXT entrypoints   │
│  Renders: element table, locator candidates, code preview,    │
│           target-framework switcher, copy/export              │
└───────────────▲───────────────────────────────┬──────────────┘
                │ messaging (webext-bridge / WXT) │
┌───────────────┴───────────────────────────────▼──────────────┐
│  Content script (injected into the page)                      │
│  • Inspector overlay (mouseover highlight + click capture)    │
│  • Locator Engine  ── produces ──▶  Locator IR                │
│  • In-page uniqueness verification (CSS/XPath + a11y resolve) │
└───────────────────────────────────────────────────────────────┘
                                │ Locator IR + POM model
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  Code Generation layer (pure, framework-agnostic, testable)   │
│  IR ─▶ [Playwright-TS] [Playwright-Py] [Selenium-Java/C#] [Puppeteer] │
└───────────────────────────────────────────────────────────────┘
```

**Key architectural improvement over today:** a **Locator Intermediate Representation (IR)** decouples
*locator strategy* from *code output*. Today, locator logic and per-framework templates are
entangled. With an IR, adding a language = one generator; changing locator strategy = zero generator
changes.

---

## 5. The Locator Engine (the core)

This is where your existing `src/content/` logic gets ported and extended — the highest-value reuse.

### 5.1 Candidate generation + ranking
For a picked element, produce an **ordered list of candidate locators**, mirroring Playwright's own
priority:

1. `data-testid` / configurable test-id attribute → `getByTestId`
2. **Role + accessible name** → `getByRole(role, { name })`
3. Label association → `getByLabel`
4. Placeholder → `getByPlaceholder`
5. Visible text → `getByText`
6. `alt` → `getByAltText`, `title` → `getByTitle`
7. `id` / stable attribute → CSS
8. Structural CSS / XPath fallback (`nth-child`)

Each candidate is **verified for uniqueness in-page** before being offered.

### 5.2 The accessibility layer (the new capability)
- `getRole(element)` (aria-query / dom-accessibility-api) → ARIA role.
- `computeAccessibleName(element)` (dom-accessibility-api) → accessible name per the W3C accname spec.
- These two feed the role/label/text locators. **No model involved — pure computation.**

### 5.3 The Locator IR (contract)
```ts
type LocatorCandidate =
  | { kind: 'testId';      value: string }
  | { kind: 'role';        role: string; name?: string; exact?: boolean }
  | { kind: 'label';       text: string; exact?: boolean }
  | { kind: 'placeholder'; text: string }
  | { kind: 'text';        text: string; exact?: boolean }
  | { kind: 'altText';     text: string }
  | { kind: 'title';       text: string }
  | { kind: 'css';         value: string }
  | { kind: 'xpath';       value: string };

interface FrameStep {
  frame: LocatorCandidate;       // a robust locator for the <iframe> element in its parent doc
}

interface LocatedElement {
  name: string;                  // derived method/property name (naming pipeline)
  tag: string;
  framePath: FrameStep[];        // top-document → target frame; empty if in the main frame (§13)
  candidates: LocatorCandidate[]; // ranked, all verified-unique (within the target frame)
  preferred: number;             // index of default choice (user-overridable)
}
```
Generators consume `candidates` and each picks the best one **they can express**: Playwright prefers
`role`/`label`; Selenium/Puppeteer (no `getByRole`) fall back to `css`/`xpath`. Carrying the *full
ranked list* in the IR is what lets one model serve every target.

### 5.4 Verification nuance
Verifying a CSS/XPath locator is trivial (`querySelectorAll().length === 1`). Verifying a *role*
locator's uniqueness means computing role+name across candidate elements and counting matches — O(n)
but bounded and cacheable. This resolver is the part that must behave like Playwright's; see §9 risk.

---

## 6. Code Generation Layer

- Each target is a **pure function**: `(POMModel) => string`. No DOM, no browser APIs → trivially
  unit-testable, fast to iterate.
- Port the *intent* of `src/profiles/templates-helpers.js` (indentation, naming, file scaffolding) into
  typed helpers.
- **Keep:** Puppeteer, Selenium (Java/C#). **Add:** Playwright (TS/JS), Playwright (Python).
  **Drop:** Robot Framework, Protractor.
- Selenium modernized to **Selenium 4** (relative locators available where useful).

---

## 7. UI Layer

- Rebuild `src/panel/*.vue` and `src/components/*` in **Vue 3 + Quasar** (not a mechanical
  Vuetify→Quasar swap — components and theming differ; budget for a real rebuild).
- Core screens: element data table, per-element candidate locator picker (with the verified/unique
  badge), live code preview with framework switcher, copy/export.
- Mount the same app in DevTools-panel / side-panel / sidebar hosts via separate WXT entrypoints that
  inject host context — keeping the "decide surface later" option open.
- **Testability now informs this choice (see §15):** Playwright can drive `chrome-extension://` pages
  (side panel / popup) but **cannot automate the browser's DevTools UI**. Recommend **side panel as the
  primary surface** for full E2E coverage; a DevTools panel, if offered, would rely on lighter testing.

---

## 8. Cross-Browser & MV3

- **WXT abstracts the per-browser manifest version**: it builds Chrome as **MV3** and Firefox as
  **MV2** by default (confirmed in Spike #2), sidestepping Firefox's still-maturing MV3 background
  model and the service-worker vs event-page difference. Firefox MV3 can be forced via config if/when
  needed.
- DevTools panel: supported in both Chrome and Firefox.
- Side panel: **Chromium-only** (`sidePanel`); Firefox uses `sidebar_action`. Host-agnostic UI (§7)
  means each browser gets the right host without forking the app.
- Content-script injection initiated from a DevTools context differs subtly across browsers — validate
  in the cross-browser spike (§9).

---

## 9. Migration Risks & De-Risking Spikes (do these first)

| # | Risk | Spike to run | Why it matters |
|---|---|---|---|
| 1 | **A11y fidelity** — our computed role/name differs from Playwright's engine, so generated `getByRole`/`getByLabel` don't actually resolve in Playwright. | Pick N real elements; generate locators; assert they resolve to the same element in a real Playwright run (compare against `playwright codegen`). | **The core feasibility question.** Everything keys off this. |
| 2 | ✅ **DONE** — **Quasar + WXT/Vite** integration (Sass, `transformAssetUrls`, plugin order). | Stood up WXT + Vue 3 + Quasar; built Chrome + Firefox; rendered banner/button/`q-table` in a real browser, 0 errors. | Stack confirmed viable; recipe captured. See `spikes/SPIKE2-RESULTS.md`. |
| 3 | **Cross-browser parity** under MV3 (background + devtools-initiated injection in Firefox). | Load the skeleton in both Chrome and Firefox; round-trip one pick→generate. | Protects the cross-browser value prop. |
| 4 | ✅ **DONE** — **A11y verification performance** on large DOMs. | Timed `generate()` per pick at 1k/5k/10k elements. Median ~14ms at ~11.7k elements (linear); p95 ~300ms worst case. | Comfortably interactive; memoize role/name index per page if the tail ever matters. See `spikes/SPIKE4-RESULTS.md`. |
| 5 | **Cross-origin frame path assembly** — correlating a child frame to a unique `<iframe>` selector in its parent. | Page with same- and cross-origin iframes; pick an element inside each; assemble + verify the full `frameLocator` chain in real Playwright. | The original tool failed on frames; this is the browser-mechanics-heavy unknown (§13). |

> **Spike #1 status: ✅ DONE — premise confirmed.** A harness (`tests/fidelity.spec.ts`) generates
> locator candidates via `dom-accessibility-api` and validates each against a *real* Playwright run.
> Result (expanded corpus, **43 elements** incl. ~18 accname/role edge cases): **43/43** got a preferred
> locator that resolved uniquely to the correct element; **35/43** via a semantic locator
> (`getByRole`/`getByLabel`/`getByText`/`getByTestId`), with deterministic CSS/XPath correctly handling
> genuinely ambiguous cases. The harness caught **3 real fidelity bugs** (`getByLabel` for buttons; over-
> broad `getByLabel`; missing CSS pseudo-content in names) — all fixed surgically, then **0 divergences**.
> See `spikes/SPIKE-RESULTS.md` and §14. **No LLM involved.**
>
> **Spike #5 status: ✅ DONE — frame assembly confirmed.** A harness (`tests/frames.spec.ts`) serves a
> nested frame tree across two origins (same-origin, cross-origin, and a 2-deep path *through* a
> cross-origin boundary), injects the engine per-frame, assembles the `frameLocator` chain by running
> the same engine on each `<iframe>` element, and validates against real Playwright: **6/6** elements
> resolved uniquely to the correct element. See `spikes/SPIKE5-RESULTS.md`. **Open item not covered by this
> harness:** the extension-runtime correlation of child `frameId` → parent `<iframe>` element
> (`webNavigation.getAllFrames` + per-frame messaging) needs a real-extension integration test —
> Playwright provides that correlation for free via `frameElement()`, so the unit harness can't prove it.

---

## 10. Reuse vs. Redesign (grounded in current `src/`)

| Existing file/dir | Disposition | Notes |
|---|---|---|
| `content/dom.js` | **Port + cleanup** | Traversal/visibility logic is valuable; port to TS, modernize. |
| `content/xpath.js` (+ tests) | **Port** | XPath still valuable (Selenium). Bring the tests across to Vitest. |
| `content/css.js` | **Redesign** | **Drop Sizzle**; rebuild on native `querySelectorAll`/`:scope`. |
| `content/locatorMatches.js` | **Port + extend** | Becomes the uniqueness verifier; extend to a11y resolution. |
| `content/elementNamingPipeline.js` | **Port + extend** | Drives method/property names; the (optional) LLM naming hook lives here. |
| `content/ModelBuilder.js` | **Redesign** | Re-center around the new Locator IR. |
| `profiles/*` (Puppeteer, Selenium) | **Rewrite as typed generators** | Use existing templates as reference for output shape. |
| `profiles/*` (Robot, Protractor) | **Drop** | Out of scope. |
| `panel/*.vue`, `components/*` | **Rebuild** | Vue 2 + Vuetify → Vue 3 + Quasar; not mechanical. |
| `background/`, `devtools/`, `manifest.json` | **Rebuild** | Re-create under WXT + MV3 (per-browser). |
| `plugins/` (Vuetify config) | **Drop/replace** | Becomes Quasar config. |

---

## 11. Optional: LLM as a Naming Enhancement (explicitly off the critical path)

If ever wanted, the *only* sensible role is **semantic naming** — improving a method name when the
accessible name is poor (`btn1` → `acceptCookiesButton`). It would be a **pluggable, optional** hook in
the naming pipeline that **degrades gracefully**: Chrome built-in AI *or* a bring-your-own API key,
with the deterministic name as the always-present fallback. Never a dependency; never touches locator
correctness.

---

## 12. Phased Roadmap

- **Phase 0 — De-risk.** Run spikes #1–#4 (§9). Go/no-go on stack and a11y fidelity.
- **Phase 1 — Core, Chrome-only.** ✅ **Scaffolded in `v3/` (repo root)** — WXT + Vue 3 + Quasar + TS extension:
  locator engine + IR + verification, inspector overlay (all frames), Playwright-TS generator, side-panel
  UI. Builds clean; unit + engine-fidelity + extension-E2E tests pass; CI + release workflows wired. See
  `v3/README.md` (repo root). *Proves the end-to-end flow.*

  **Scope qualification (assessed 2026-09-04).** Phase 1 was scaffolded on 22 Jun, four days *before*
  the PRD was written, so it was never built against it. What exists: pick toggle, list of picked
  elements with editable names, role chip, per-element candidate switching, live Playwright-TS preview,
  copy. Not yet built: scan (FR-C2), locator test/highlight-with-count (FR-L4), table view + toolbar
  (FR-M3), interaction-type classification (FR-M4), the other five generators (FR-G1), output modes
  (FR-G3/FR-G6), settings (FR-S*), DevTools panel surface (FR-U1).

  **Known gap — frames are proven but not plumbed.** The overlay injects into all frames and Spike #5
  validated `frameLocator` chain assembly, but `v3/entrypoints/sidepanel/App.vue` hardcodes
  `framePath: []` when a picked element enters the model. Nothing frame-related reaches the generators.
- **Phase 2 — Generators.** Add Playwright-Python, Selenium Java/C#, Puppeteer. Port unit tests.
- **Phase 3 — Cross-browser.** Firefox parity; host-agnostic UI across panel/side-panel/sidebar.
- **Phase 4 — Polish.** Options/settings, persistence, export, dark mode, accessibility of the tool UI.
- **Phase 5 — (Optional).** LLM-assisted naming enhancement.

> **Sequencing note (open).** The verification approach (§15) requires manual testing on both browsers
> throughout. The UI is currently side-panel-only and Firefox has no side-panel API, so under the order
> above Firefox cannot be manually tested until Phase 3. Recommendation: pull the host-agnostic shell
> (same app mounted in side panel + DevTools panel) to the front, ahead of new features, so every
> subsequent step is verifiable on both browsers. Not yet decided.

> Frame support (§13) is not a standalone phase — it threads through Phase 1 (picker injects into all
> frames; IR carries `framePath`) and the generators (Phase 2). Spike #5 gates the cross-origin part.

---

## 13. Frame & Cross-Origin Support

The original tool did not work across frames. An element inside an `<iframe>` lives in a separate
document/browsing context; a content script in the top frame **cannot read a cross-origin iframe's
DOM**, and a bare selector like `#email` is meaningless from the parent. The design that handles it:

- **Inject the content script into all frames** (`all_frames: true`). Each frame runs its own engine
  instance against *its own* document — so **the locator engine needs no changes**; it just runs
  per-frame. Each frame is identified by its `frameId`.
- **The IR carries a `framePath`** (§5.3): the ordered chain of `<iframe>` locators from the top
  document down to the target element's frame. Empty for main-frame elements.
- **Generators emit frame traversal per framework:**
  - Playwright → `page.frameLocator(sel).frameLocator(...).getByRole(...)`
  - Selenium → `switchTo().frame(...)` … `switchTo().defaultContent()` (stateful)
  - Puppeteer → resolve the `Frame`, then query within it
- **The hard part — cross-origin path assembly.** The child frame computes its *local* locator fine
  (it executes in that origin). The unknown is correlating that child `frameId` to a unique `<iframe>`
  **selector in the parent**: enumerate the frame tree via `webNavigation.getAllFrames`, map
  `frameId`→parent `<iframe>` element, and have each frame's content script report its local locator up
  to the panel. Same-origin is trivial (`frameElement`); cross-origin is the browser-mechanics unknown
  de-risked by **Spike #5** (§9).
- **Honest caveat:** deeply nested cross-origin frames and dynamically-injected frames raise the
  difficulty; the spike should probe these explicitly.

---

## 14. Decision: Reusing Playwright's Tested Code

Reuse Playwright's **correctness**, not its **code**. Evaluated against the "only reuse if it saves
effort" bar:

| Playwright internal | Reuse? | Why |
|---|---|---|
| accname / role computation (`roleUtils.ts` + accname module) | **Via library, yes** | `dom-accessibility-api` is a standalone, maintained, tested package that already matches Playwright on our corpus. Hand-rolling the accname spec is a tar-pit. Clear effort saving. |
| selector generator (`selectorGenerator.ts`) | **No — build our own** | It emits **Playwright-only** selector strings; serving Selenium/Puppeteer/Python would mean reverse-engineering its output back into an IR — *more* work. It's also an **unpublished, version-coupled** internal (whole injected bundle or nothing) → permanent sync tax that negates the "already tested" benefit. Our IR-first generator is modest code and serves all four targets. |
| in-page resolution engine (`injectedScript.ts`) | **No — use real Playwright as a test oracle instead** | We get Playwright's tested resolution as our **CI fidelity gate** (Spike #1's harness), not as a runtime dependency. Fidelity guarantee, zero coupling. |

**Net:** own the IR-first generator; lean on a library for the spec-heavy accname/role; let the
real-Playwright harness be the oracle that proves fidelity over time. If the harness ever shows
`dom-accessibility-api` diverging from Playwright on cases that matter, vendor that *specific*
algorithm surgically — a measured response, not an upfront wholesale dependency.

> **Measured (expanded corpus, ~18 edge cases + the originals = 43 elements):** `dom-accessibility-api`
> diverged from Playwright in exactly **2 narrow, well-understood ways**, both fixed surgically — **no
> need to vendor Playwright's engine**:
> 1. **CSS `::before`/`::after` content** is folded into Playwright's accessible name but not by
>    `dom-accessibility-api`. Fix: read pseudo-element `content` for content-derived names (~10 lines).
> 2. **`getByLabel` ≠ accessible name** — Playwright's `getByLabel` matches only a real `<label>`
>    association or `aria-label`, not names sourced from `title` / submit `value` / `aria-labelledby`.
>    Fix: gate `getByLabel` emission on those two conditions (the other sources still get `getByRole`).
>
> After both fixes: **43/43 resolve, 0 divergences.** Hidden / `aria-hidden` / `visibility:hidden`
> cases needed no special handling — the library correctly yields no name, so the engine falls back to
> CSS. One perf note for Spike #4: reading pseudo-content per element adds two `getComputedStyle` calls
> to the DOM-wide role scan. See `spikes/SPIKE-RESULTS.md`.

---

## 15. Testing Strategy

Coverage was a weak point of the original extension. The rewrite targets a real test pyramid, enabled by
the deliberately pure/decoupled architecture (IR + pure generators) and a real-browser harness.

| Layer | Tool | Covers |
|---|---|---|
| **Unit** | Vitest (+ WXT `WxtVitest`, fake `browser.*`) | IR utilities, code generators (snapshot/golden tests of emitted POMs), naming pipeline, pure logic |
| **Engine / fidelity** | Playwright in real Chromium | Locator engine vs Playwright's own resolution — **prototyped** (`tests/fidelity.spec.ts`, 43/43) |
| **Generated-code round-trip** | Playwright | *Execute* the generated POM against the source fixtures; assert locators resolve. Strongest correctness signal. |
| **Extension E2E** | Playwright persistent context | Load the **built** extension, drive the picker on a test page → assert generated code in the side panel |

**Proven:** `tests/extension-e2e.spec.ts` loads the built extension into Chromium (persistent context),
resolves the extension id from its MV3 service worker, opens the popup as a `chrome-extension://` page,
and asserts the Quasar UI rendered — running under **`--headless=new`** (CI-friendly, no display needed).

**Verification approach — manual testing is the completion gate.** Automated tests are a safety net,
never the criterion for calling something done. Nothing is complete until it has been exercised by hand
in a real browser, on real pages, across browsers and varied DOM structures. The devil is in the detail
here: overlays, sticky headers, shadow roots, frames and unusual markup fail in ways no unit test
anticipates. This drives the build sequence — a loadable UI first, then functionality added
incrementally, each increment manually verified before the next begins.

The automation earns its place by doing what hand-testing cannot repeat cheaply: the fidelity spec
re-runs 43 DOM edge cases against real Playwright on every change, and the extension E2E proves the
built extension still loads before any manual session starts.

**Constraints (honest):**
- **The locator engine can't be meaningfully unit-tested in jsdom/happy-dom** — no layout,
  `getComputedStyle` for pseudo-content, or full ARIA. Its correctness gate **must** be the in-browser
  Playwright harness (this is why all spikes used real Chromium).
- **Firefox E2E gap:** Playwright cannot load extensions into its Firefox build. Firefox gets unit +
  engine tests + a `web-ext run` smoke test; full interactive E2E is Chromium-only.
- **DevTools-panel surfaces are hard to E2E** (Playwright can't drive DevTools chrome) → favors the side
  panel as primary surface (§7).

---

## 16. Build / Package / Release Automation

Fully scriptable for ongoing releases — WXT provides the packaging and multi-store publishing.

```jsonc
// package.json scripts (illustrative)
"build":  "wxt build && wxt build -b firefox",
"zip":    "wxt zip && wxt zip -b firefox",   // store-ready zips incl. the Firefox SOURCES zip AMO requires
"test":   "vitest run && playwright test",
"submit": "wxt submit --chrome-zip .output/*-chrome.zip --firefox-zip .output/*-firefox.zip --firefox-sources-zip .output/*-sources.zip"
```

- **`wxt zip`** → store-ready zips (+ Firefox sources zip). **`wxt submit`** → publishes to Chrome Web
  Store, Firefox Add-ons, and Edge (wraps `publish-browser-extension`); `wxt submit init` scaffolds creds.
- **CI (GitHub Actions) on a version tag:** install → **run the full test suite as a gate** → `zip` →
  `submit`, with store credentials from Actions secrets. Versioning via `npm version` or Changesets.

**Caveats (honest):**
- **First listing is manual** in each store (metadata, screenshots); the API only *updates* existing
  items afterward.
- **"Deploy" = automated submission, not instant go-live** — CWS/AMO gate publishing behind review
  (minutes → days).
- **One-time credential setup:** CWS needs a Google OAuth client id/secret/refresh token + extension id;
  AMO needs a JWT issuer/secret. Stored as CI secrets.
