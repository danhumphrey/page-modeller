# Review brief — 3.0.0 release candidate

For a reviewer coming to this cold, before the extension is submitted to the stores.

## What this is

A browser extension that picks DOM elements and generates page-object code for six test-automation
targets. Version 3 is a ground-up rewrite of a ten-year-old extension that still ships; the old code
is gone from this tree and lives at the `v2.5.1-final` tag.

Review the **current tree**, not the diff against `master`. `master` holds 2.5.1, so a diff is the
whole rewrite and tells you nothing.

## What is authoritative

| | |
|---|---|
| `docs/SPEC.md` | **What the tool does.** If the code and this disagree, that is a finding |
| `docs/CONSTRAINTS.md` | Browser floors, the in-place upgrade, what is deliberately out of scope |
| `docs/REWRITE-PLAN.md` | Architecture and why |
| `CLAUDE.md` | Gotchas discovered the hard way. Several are non-obvious and cost hours |

## Deliberate — do not report these as defects

Each of these looks wrong and is not. If you believe one is genuinely mistaken, argue it against the
reasoning in the spec rather than reporting it as an oversight.

- **`<all_urls>` host permission.** The user chooses which page to model; it cannot be known in
  advance. Justified in `docs/STORE-LISTING.md`.
- **The eye over-counts rather than under-counts** where a framework's matching differs from the
  browser's (SPEC §19). Amber sends the user to look; a green tick on a locator matching six does not.
- **Frame and shadow chains are read-only in the UI** (SPEC §16, §19). They are where the element
  *is*, not how it is found within that context.
- **`xpath` is excluded for a shadow element** in every framework. No engine can XPath into a shadow
  tree; measured in `tests/shadow.probe.spec.ts`.
- **v2.5.1 is not a baseline.** Where current practice differs from what the old extension did, v3
  takes current practice. Parity is a floor for features, never a reason to keep a dated technique.
- **No LLM, no network.** Entirely offline and deterministic, by constraint (CONSTRAINTS NFR-2).
- **Automated tests are a net, not the gate.** Manual testing in a real browser is what decides done.
  Do not propose replacing hand-testing with more automation.
- **Chrome store submission is manual.** Firefox is automated; Chrome's API is not worth its setup
  and its V1 is retired in October 2026.

## What is worth your attention

In rough order of what would hurt most if wrong:

1. **Correctness of generated code.** Six targets, three shapes. A locator that does not resolve, or
   code that does not compile or run, is the worst failure this tool has — the user pastes it into a
   test suite and finds out later.
2. **Cross-browser behaviour.** Chrome and Firefox, MV3 on both. Firefox has **no automated
   coverage at all** and cannot easily get any (`docs/spikes/SPIKE6-FIREFOX-E2E.md`), so anything
   Firefox-specific is unguarded. Every cross-browser bug so far passed the Chrome suite.
3. **Tests that do not test what they claim.** Several have been found passing for the wrong reason
   during this project. A test whose assertion holds with the code reverted is worse than none.
4. **Security and privacy.** It reads the DOM of arbitrary pages. Look for anything that could leak
   page content, execute page-controlled strings, or trust a message it should not.
5. **Store-review risk.** Anything a reviewer would reject or question.

## Where to start, per area

- `src/engine/` — locator generation, ranking, resolution. The crown jewels
- `src/generators/`, `src/locators/` — the six targets and their shared spelling
- `entrypoints/` — content script, background, panels. Messaging and lifecycle
- `ui/` — Vue 3 + Quasar panel
- `tests/` — is each test load-bearing?

## How to report

Findings ranked by severity, each with a concrete failure: the input or state, and the wrong output
or behaviour. "This could be clearer" is not a finding. If you cannot describe how it breaks, leave
it out.
