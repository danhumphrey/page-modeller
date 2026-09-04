# Session Context — origin of the v3 rewrite

Reconstructed 2026-09-03. The original session's transcript is **lost** (no `.jsonl` under
`~/.claude/projects/`; no backup). This doc replaces it.

The work described here was done in a throwaway POC folder, `~/projects/chrome-llm-test`, and was
**migrated into this repo on the `v3-rewrite` branch (2026-09-03)**. Paths below are repo-relative. The spike
*harnesses* were not migrated — their results are in `docs/v3/spikes/`; the POC folder was not a git
repo, so once deleted it is gone.

- **Session:** `a9bc529c-0832-4e46-af45-64f38bf45fd5`, 22 Jun 2026 09:42 → 26 Jun 2026 10:15.
- **Only surviving trace:** the user prompt log in `~/.claude-work/history.jsonl` (grep `chrome-llm-test`).
  Assistant replies are gone. Treat the docs below as the record.

## How we got here

Started as a feasibility test of **Chrome's built-in LLM** for generating Page Object Models and
selectors from a DevTools-style element pick — hence the folder name. Dan flagged early that an LLM
might be unnecessary and would exclude Firefox. Measured it, agreed, and pivoted: the project became a
**deterministic** ground-up rewrite of [page-modeller](https://github.com/danhumphrey/page-modeller)
v2.5.1. **No LLM in the critical path** (`docs/v3/REWRITE-PLAN.md` §1, §11) — accessibility locators are
computable from published specs; a model would be slower, non-reproducible, hardware-gated, and would
kill Firefox support. Reserved only as an optional semantic-naming enhancement (Phase 5).

On 26 Jun the framing was fixed: **this folder is a throwaway POC.** The real work replaces the
existing repo and directory `~/projects/page-modeller`, in place (same CWS/AMO listings and IDs).

## Decisions made (all still current)

| | |
|---|---|
| Stack | TypeScript strict · Vue 3 · Quasar · WXT · Pinia · Vitest · Playwright |
| Dropped | Sizzle, Vuetify, Webpack, Robot Framework, Protractor, Angular locators |
| Added vs v2.5.1 | Modern Playwright a11y locators · frame/cross-origin support · side panel |
| A11y computation | `dom-accessibility-api` + `aria-query`; **not** vendored from Playwright (§14) |
| Selectors | Native `querySelectorAll` + `document.evaluate` |
| Surfaces | Side panel (Chrome) + DevTools panel, user's choice; Firefox = DevTools only |
| Deferred | In-browser action replay (trusted-event caveat) |

## Artefacts

| Path | What it is |
|---|---|
| `docs/v3/PRD.md` | Owns *what*. Written last (26 Jun); §7 all decisions resolved, §8 backlog empty. |
| `docs/v3/REWRITE-PLAN.md` | Owns *how*. Architecture + feasibility. **Verdict: GO.** |
| `docs/v3/spikes/SPIKE-RESULTS.md` | #1 a11y fidelity — 43/43 unique + correct vs real Playwright, 0 divergences. |
| `docs/v3/spikes/SPIKE2-RESULTS.md` | #2 WXT+Vue+Quasar builds & renders, Chrome + Firefox (FF→MV2 by default). |
| `docs/v3/spikes/SPIKE4-RESULTS.md` | #4 perf — ~14ms median/pick at 11.7k elements; p95 tail ~300ms, memoisable. |
| `docs/v3/spikes/SPIKE5-RESULTS.md` | #5 frames — 6/6 nested/cross-origin `frameLocator` chains resolve. |
| `v3/` | Phase 1 POC, self-contained (own `package.json`): engine + IR + verification, all-frames overlay, Playwright-TS generator, side panel, unit + fidelity + extension-E2E tests. See `v3/README.md`. |
| `src/` (root) | **v2.5.1**, untouched — still what ships. Not v3. |

`v3/.github/workflows/` came across with the POC but is **inert** — GitHub only reads `.github/` at the
repo root. Merge it with the existing root CI when v3 is ready to build.

## State & next step

Phase 0 (de-risk) and Phase 1 (Chrome-only core) are done. Next is **Phase 2 — generators**
(Playwright-Python, Selenium Java/C#/Python, Puppeteer), then Phase 3 cross-browser — but per the
26 Jun decision, built **here** in `page-modeller` (in place, preserving the CWS/AMO listings and
extension IDs) rather than in the POC folder.

---

## Appendix — verbatim user prompts

All 26 prompts from session `a9bc529c-0832-4e46-af45-64f38bf45fd5`, in order, exactly as typed (typos included),
recovered from `~/.claude-work/history.jsonl` before it rolled over. Assistant replies are not
recoverable. `[Image #n]` / `[Pasted text #n]` markers refer to attachments that are gone.

**1. 22 Jun 09:42**

> I want to test the feasability of building a web extension which generates page object models and css selectors using the built-in LLM. I want to be abe to select a dom element (in the same way as devtools does) and generate playwright or selenium code.

**2. 22 Jun 09:43**

> empty

**3. 22 Jun 09:43**

> brand new

**4. 22 Jun 09:48**

> THis is my existing extension - https://github.com/danhumphrey/page-modeller. This is a feasability study on whether we can rewrite a newer version of this. My existing extension creates (and verifies) all locators in code but DOES NOT support modern Playwright accessibility locators. Maybe an LLM is unnecessary here if it isn't up to the task (it would exclude Firefox support too), so maybe we shuold just consider a rewrite without an LLM?

**5. 22 Jun 09:57**

> My code is VERY out of date... it's JavaScript, it uses old lib versions, the VERY old sizzle selector engine and lots of custom code. I think I want to rewrite the entire project with Vue and Quasar (the existing one uses Vuetify), modern npm libs etc. as a TypeScript project. We can repurpose and reuse existing code where it makes sense and rethink or redesign some of it where the current approach falls short, is out of date or could be improved. I also wouldn't bother supporting Robot framework (and maybe some others) bit it would have to have strong support for Playwright

**6. 22 Jun 10:06**

> Yes, build spike #1

**7. 22 Jun 10:07**

> I'm also tempted to implement a new feature.... in browser scripts where we can actually replay a set of actions against the dom

**8. 22 Jun 10:12**

> I wonder if we should borrow / reuse the Playwright code for the aria locators? e.g. https://github.com/microsoft/playwright/blob/main/packages/injected/src/roleUtils.ts is this worth it or easy enough to replicate ourselves?

**9. 22 Jun 10:13**

> not just roleUtils... that was just one example file. but only if it saves us time and effort (playwright is already tested)

**10. 22 Jun 10:13**

> another point to consider... my original code didn't work for frames... we need frame support too.

**11. 22 Jun 10:14**

> ignore/defer replay of actions until later

**12. 22 Jun 10:17**

> run spike #5

**13. 22 Jun 10:23**

> run spike #2

**14. 22 Jun 10:29**

> expand the fidelity corpus with edge cases

**15. 22 Jun 11:13**

> run spike #4

**16. 22 Jun 11:17**

> I want better test coverage than I had in the existng extension.... can we also use Playwright to test the extension (loaded in a browser). I also want fully automated (npm scripts) build, package, deploy to chrome store etc.  (if possible)

**17. 22 Jun 11:22**

> scaffold Phase 1

**18. 22 Jun 11:35**

> why package files at root and in the app dir?

**19. 22 Jun 11:39**

> 1. I can't seem to load an extension from a . directory (.output) in the browser.... why is iut output here?

**20. 26 Jun 09:41**

> no it's fine. I already have a project repo and existing directory.... I consider what we have built here to be a prototype POC, but I want to fully replace the existing repo and directory (~/projects/page-modeller) when I'm ready to... we're also going a little off tangent with the current POC here, so I need to specify the requirements better...

**21. 26 Jun 09:46**

> Yes, inventory ~/projects/page-modeller and draft a PRD. When documenting features etc... keep it succinct, avoid verbose writing and repetition. Less is more, please.

**22. 26 Jun 09:55**

> 1. Firefox doesn't yet support the side panel, so we need the panel to be able to be shown either as a sidepanel or as a devtools panel (both options available to the user). 2. Yes. 3. Yes 100%. 4. I think we should migrate but will need to discuss implications pros/cons of this if required. 5. What does this mean?

**23. 26 Jun 10:04**

> 5. The Scan button allows the user to select a root element from the viewport, (just like the devtools select element to inspect button)... the selected element is considered the root dom element and its interactive children are added to the model. The add element button, then allows the user to add individual elements to the model from anywhere in the viewport. While we are on the topic, this is what that view looks like after a model has been scanned.... [Image #1] we maintain a table view. From there we can find and highlight matches [Image #2] and edit elements in the model to select a new locator type (we already generate these locators), but the user can overwrite the locator as they wish [Image #3]

**24. 26 Jun 10:11**

> For even more clarification then, the generate code button presents this window:[Image #4]. It currently present methods for the user to copy paste into an existing page object class, but I want an option here to allow the user to toggle between methods only (as now) and another output which would wrapped in a page object class. Also note, here is the code that's been output... you'll get this by understanding how I use the templates, but to clarify, some elements (links, buttons for example) produce  a getElement and clickElement method, some elements (inputs) get a set and get method... etc. the methods are specific to the element type:   [Pasted text #5 +1356 lines]

**25. 26 Jun 10:13**

> I don't think this is much of a gap... while you didn't do this in the POC, I have already implemented this approach and have over 1000 users... it seems to work well for them, but all of this is open to improvements and enhanced capabilities

**26. 26 Jun 10:15**

> no we can keep it in a dedicated section in the same doc when/if we identify enhancement candidates
