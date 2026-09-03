# Page Modeller v3 — PRD

Ground-up rewrite to replace `page-modeller` v2.5.1. Technical approach validated in `REWRITE-PLAN.md`
(POC: `v3/` at the repo root). This doc owns *what*, not *how*.

## 1. Summary
A cross-browser extension to pick DOM elements (incl. inside frames) and generate verified Page Object
Models — with first-class modern **Playwright accessibility locators**. Deterministic, no LLM.

## 2. Goals
- Close the v2.5.1 gap: modern Playwright (`getByRole`/`getByLabel`/…) output.
- Preserve cross-browser support and live locator verification.
- Modern stack, strong tests, automated release.

## 3. Replace v2.5.1 — keep / change / drop

| Area | v2.5.1 | v3 |
|---|---|---|
| Pick / inspect element | ✅ | **Keep** |
| Scan page (auto-discover elements) | ✅ | **Keep** |
| Live locator test (highlight matches) | ✅ | **Keep** |
| Edit name / swap strategy per element | ✅ | **Keep** |
| Uniqueness verification | ✅ | **Keep** |
| Locator engine | Simmer.js + custom XPath | **Replace** — native + `dom-accessibility-api` |
| Angular locators (ngModel/ngBinding) | ✅ | **Drop** |
| Surface | DevTools panel | **Both** → side panel (Chrome) + DevTools panel; user choice. Firefox: DevTools panel only |
| Frameworks | Selenium J/C#/Py, Puppeteer, Robot, Protractor | **Change** → see FR-G; drop Robot, Protractor |
| Settings (tooltips, dark, hidden els, row-click) | ✅ | **Keep** |
| Frames / iframes | ❌ | **Add** |
| Stack | Vue 2 / Vuetify / Webpack | **Replace** → Vue 3 / Quasar / WXT / TS |

## 4. Functional requirements

**Surface**
- FR-U1 Same UI available as a side panel (Chrome) and a DevTools panel; user selects. Firefox: DevTools panel only (no side-panel API).

**Capture**
- FR-C1 **Add**: pick a single element anywhere via DevTools-style overlay (hover highlight + click).
- FR-C2 **Scan**: inspect-pick a root element; auto-add its interactive descendants.
- FR-C3 Pick elements inside same- and cross-origin frames; record frame path.

**Locators**
- FR-L1 Generate ranked candidates: testId → role+name → label → placeholder → text → altText → title → css → xpath.
- FR-L2 Verify each candidate resolves to exactly one element, in-page.
- FR-L3 Per element: switch among generated candidates, or manually overwrite locator type + value.
- FR-L4 "Test" highlights all matching elements in-page and reports the match count.
- FR-L5 Available locator types are framework-specific (Playwright: role/label/text/testId/css/xpath; Selenium: id/name/linkText/css/xpath…).

**Model**
- FR-M1 Hold a session model of multiple named elements; edit name, reorder, delete.
- FR-M2 Derive readable, unique property names from accessible name/role.
- FR-M4 Classify each element's interaction type (actionable / text / toggle / select) to drive method generation (FR-G2).
- FR-M3 Table view (Name · Locator `type:value`) with per-row highlight/edit/delete; toolbar: scan · add · clear-all · framework selector · view code.

**Generate**
- FR-G1 Targets: Playwright TS/JS, Playwright Python, Selenium Java, Selenium C#, Selenium Python, Puppeteer.
- FR-G2 Emit **element-type-specific methods**: getter for every element + actions by type — click (link/button), get/set value (text input, textarea), get/set checked (checkbox/radio), select option (dropdown).
- FR-G3 **Output-mode toggle**: methods-only (paste into existing class) ↔ full Page Object class.
- FR-G4 Code dialog: preview + copy; download as file.
- FR-G5 Generated Playwright locators must resolve in real Playwright (CI-gated).

**Settings**
- FR-S1 Tooltips, dark mode, model hidden elements, row-click-to-highlight.
- FR-S2 Default target framework; configurable test-id attribute name; surface preference (FR-U1).
- FR-S3 Migrate v2.5.1 settings on first run after upgrade (map to new schema; defaults for new options).

## 5. Non-functional
- NFR-1 Chrome + Firefox (WXT: MV3 / MV2 per browser).
- NFR-2 Fully offline/deterministic; no network, no LLM.
- NFR-3 Per-pick latency interactive (<~100ms typical DOM).
- NFR-4 Test pyramid: unit (generators) + engine-fidelity vs real Playwright + extension E2E.
- NFR-5 Automated build → zip → multi-store submit.
- NFR-6 Ship as in-place update to existing CWS + AMO listings; preserve extension IDs (CWS item, AMO `gecko.id`). User storage persists across upgrade.

## 6. Out of scope (v1)
Action recording/replay · LLM-assisted naming · object-repository / non-code exports · Robot · Protractor · Angular locators.

## 7. Decisions (resolved)
Surfaces = side panel (Chrome) + DevTools panel, user choice, Firefox = DevTools only · Selenium Python in v1 · reuse existing CWS/AMO listings + IDs · migrate v2.5.1 settings · scan = inspect-pick root → add interactive descendants; add = pick individual elements. No open items.

## 8. Enhancements (backlog)
Candidates beyond parity + agreed v3 additions. Populate as identified; kept separate from the must-have requirements above.

- _(none yet)_
