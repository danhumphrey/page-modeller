# CLAUDE.md

## Orientation — two codebases live here

| | Ships today | The rewrite |
|---|---|---|
| Version | **v2.5.1** | **v3** |
| Branch | `master` | `v3-rewrite` |
| Code | `src/` (repo root) | `v3/` |
| Stack | JS · Vue 2 · Vuetify · Webpack · Sizzle | TS · Vue 3 · Quasar · WXT · Vite |

They are independent trees with separate `package.json`s and toolchains. **Never mix them in one
change.** v3 work goes on the `v3-rewrite` branch, inside `v3/`.

Note the branch is `v3-rewrite`, not `v3` — a branch named `v3` would be ambiguous with the `v3/`
directory in every revision argument (`git log v3`, `git show v3:file`).

**Branch from `v3-rewrite`, not from the branch you happen to be on.** PRs here are squash-merged, so a
branch cut from another branch carries commits that land again under a different identity — and every
file both touched then conflicts, even though the content is identical. Recovery is
`git rebase --onto origin/v3-rewrite <last commit of the parent branch> <your branch>`, which replays
only your own commits.

**Always `gh pr create --base v3-rewrite`.** `gh` defaults the base to the repo's default branch,
`master`. A v3 branch PR'd that way does not carry one commit — squash-merging it collapses the whole
`v3-rewrite`..branch difference into `master` (97 files the one time it happened, #75/#76).

> **Until the `v3-rewrite` branch merges, `v3/` and `docs/v3/` exist only on that branch** — `git checkout v3-rewrite` before
> looking for anything below. This file is on `master` so the orientation is available from either side.

## v3 — the rewrite

On the `v3-rewrite` branch. Read `docs/v3/SPEC.md` (owns *what the tool does*) before changing behaviour,
and `docs/v3/REWRITE-PLAN.md` (owns *how*) before changing architecture. `docs/v3/SESSION-CONTEXT.md` is
the history. Spike evidence is in `docs/v3/spikes/`.

**`docs/v3/PRD.md` is not authoritative for behaviour** — it was generated from the locator spike before
anyone wrote down what the tool does, and several of its FR-* items describe functionality that does not
exist (FR-G2's class generation, most obviously). Its NFRs and store/release constraints still hold.

**Status:** the host-agnostic shell is built and hand-verified on both browsers. Behaviour was specced
from scratch with the author on 2026-09-08 (`SPEC.md`, 18 sections). **Next is stripping the spike UI**,
then rebuilding to the spec one manually-verifiable increment at a time. Roadmap: `REWRITE-PLAN.md` §12.

The spike UI in `v3/ui/` and `v3/src/generators/` predates the spec and does not match it. Only
`v3/src/engine/` and its fidelity test survive.

Run everything from `v3/` — it is self-contained:

```
npm test          # unit + engine bundle + build + Playwright (the gate)
npm run dev       # WXT dev server
npm run typecheck # strict TS over the pure core
```

### Constraints that bind v3

- **No LLM in the critical path.** Locators are computed deterministically from published a11y specs.
  This was measured, not assumed (`REWRITE-PLAN.md` §1, §11). Fully offline, no network.
- **Cross-browser.** Chrome + Firefox, **MV3 on both** — v2.5.1 already ships MV3 to AMO, so MV2 would be
  a downgrade on an in-place update. Three surfaces off one host-agnostic app: Chrome side panel,
  Firefox sidebar (`sidebar_action`), DevTools panel on both.
- **Ships as an in-place update** to the existing Chrome Web Store and AMO listings. The CWS item ID
  and AMO `gecko.id` must be preserved, and user storage must survive the upgrade.
- **Locator fidelity is the core contract.** `v3/tests/engine.fidelity.spec.ts` checks generated
  locators against real Playwright resolution. If you touch the engine, that test is the arbiter.

## v2.5.1 — the shipping extension

Root `src/`, built with Webpack, tested with Jest. It is still what users run, so treat it as
maintenance-only.

`npm audit` at the root reports ~19–31 vulnerabilities. **Do not bulk-fix them.** The only two that
reach shipped code are `vue` and `vuetify` — Vue 2 and Vuetify, which v3 replaces outright. The rest is
dev tooling on a codebase being retired. Fix something here only if asked, or if it is being actively
exploited.

## Gotchas

- **v3 needs Node 22+.** jsdom's bundled undici calls `webidl.util.markAsUncloneable`, absent on Node
  20, and every jsdom component test fails to start with `Failed to start forks worker`. CI pins 24.
- **Root CI runs both trees.** `.github/workflows/ci.yml` has a `test` job for v2.5.1's `src/` and a
  `v3` job for the rewrite. GitHub reads workflows from the repo root only, so anything under
  `v3/.github/` is inert — the v3 CI workflow lived there and never ran once.
- `v3/.github/workflows/release.yml` is **still inert**, deliberately: at the root it would fire on any
  `v*` tag and submit v3 to the stores. Move it when v3 is ready to ship, and give it a tag prefix that
  cannot collide with a v2.5.1 tag.
- **Root CI is the only CI, and it sees the whole repo.** It runs on every `pull_request`, so anything
  added anywhere in the tree lands in its path. Root Jest had no ignore patterns and walked into `v3/`,
  handing TypeScript to a Babel configured for v2.5.1's JS — three suites failed to parse the first time
  a branch containing `v3/` was PR'd. `/v3/` is now in `testPathIgnorePatterns`; `lint`, `prettier:check`
  and `build` were already scoped to `src`. Check the root scripts before adding a tree.
- Build output is gitignored (`/v3/.output`, `/v3/.wxt`, `/v3/.test-dist`, `/v3/test-results`).
- `v3/` output sizes are small by design; WXT 0.21 emits little runtime boilerplate.

- **A sandboxed iframe is unreachable on Firefox.** `sandbox="allow-scripts"` gives a null principal;
  Firefox's `match_about_blank` only injects where the principal is *inherited*, and it has no
  equivalent of Chrome's `match_origin_as_fallback`. Nothing to fix — but it works on Chrome, so a
  Chrome-only hand-test will not show it. `tests/fixtures/frames.html` has one to check against.
- **`browser.tabs` is undefined in a Firefox DevTools panel.** A devtools page is granted only
  `devtools.*`, `runtime.*` and a few others. Chrome tolerates the direct call, so a regression is
  invisible on Chrome and in every test we can run. The panel goes through the background relay
  (`RELAY_TO_TAB`); a unit test scans `ui/` to keep it that way.
- **`sender.tab` is not reliable in a Firefox DevTools page.** A content script's `runtime.sendMessage`
  arrives without it, so a `sender.tab.id === myTab` filter silently drops every message. The background
  always sees the sender, so it stamps the tab and re-broadcasts as `FROM_TAB`; panels filter on that.
- **Never send Vue reactive state through `tabs.sendMessage`.** Anything read out of a `ref` is a Proxy,
  and Firefox serialises messages with structured clone, which throws `DataCloneError` on a Proxy —
  Chrome's path tolerates it, so this fails on Firefox only and presents as an unreachable tab. `send()`
  in `ui/App.vue` JSON round-trips for this reason; anything bypassing it must do the same.

## Verification — manual testing is the completion gate

**Firefox has no automated coverage, and cannot easily get any.** Playwright *installs* a Firefox
extension fine (`playwright-webextext`), but Juggler cannot navigate to `moz-extension://` pages, so the
panel is undrivable — see `docs/v3/spikes/SPIKE6-FIREFOX-E2E.md`. Every cross-browser bug so far passed
the Chrome suite. Hand-test Firefox.

**Automated tests are a net, not the criterion for done.** Nothing is complete until it has been
exercised by hand in a real browser, on real pages, across browsers and varied DOM structures. Do not
report work finished on the strength of passing unit tests. The failures that matter here — overlays,
sticky headers, shadow roots, frames, unusual markup — are ones no unit test anticipates.

This drives the build sequence: **a loadable UI first, then functionality added incrementally**, each
increment manually verified in the browser before the next begins. Prefer a change that can be clicked
through today over a larger one that cannot.

The automation that does earn its place is the part hand-testing cannot repeat cheaply: the fidelity
spec re-runs 43 DOM edge cases against real Playwright on every change, and the extension E2E proves the
built extension still loads before a manual session starts. Keep both green, but neither is the gate.

### What is verified per target

Two separate questions: does the locator find the element, and is the emitted code valid.

| Target | Locator semantics | Generated code |
|---|---|---|
| Playwright TS | ✅ every expression resolved in real Playwright | ✅ `tsc` against `@playwright/test` |
| Puppeteer | ✅ real Puppeteer (`puppeteer.fidelity.spec.ts`) | ✅ `tsc` against `puppeteer-core` |
| Playwright Python | ✅ inherited — proven the mechanical transform of the TS spelling | ✅ `python3 -m ast` |
| Selenium Python | ⚠️ strategy only | ✅ `python3 -m ast` |
| Selenium Java | ⚠️ strategy only | ✅ `javac` against selenium-api + selenium-support |
| Selenium C# | ⚠️ strategy only | ✅ `dotnet build` against Selenium.WebDriver |

⚠️ **strategy only**: `tests/pw-builder.ts` resolves each `By` strategy as the equivalent CSS/XPath in
real Playwright, so *which* strategy is right is checked. The spelling (`By.Name` / `By.NAME`) is
constant tables under unit test, and the API (`SelectElement.SelectByText`) is unchecked.

The Java and C# checks need `npm run fetch:test-deps` once — a Maven jar download and a NuGet restore.
Deliberately not part of `npm test`, so the gate still works offline and on a machine with no JDK.
Toolchain-gated tests **skip loudly**, never silently.

A compile check is not a semantic one. It proves `SelectElement.SelectByText` exists and that
`params string[]` is legal; it cannot prove the method does what the element needs.

## v2.5.1 is not the default

The shipping code is 10-15 years old and carries decisions made for a browser landscape that no longer
exists — `tagName` checks instead of ARIA roles, `getAttribute("value")` instead of `getDomProperty`,
Sizzle instead of native selectors. **Where current best practice differs from what v2.5.1 does, v3
takes current best practice.** Parity is a floor for *features*, never a reason to carry a dated
technique forward.

So don't frame a choice as "keep existing behaviour vs change it" — the existing behaviour has no
special standing. Establish what is correct now, and flag it only if the change has a user-visible
consequence worth calling out.

## Conventions

- **Docs: succinct.** No verbose prose, no repetition. Less is more.
- Commit messages state what changed and why; no filler.
