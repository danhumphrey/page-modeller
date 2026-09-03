# CLAUDE.md

## Orientation — two codebases live here

| | Ships today | The rewrite |
|---|---|---|
| Version | **v2.5.1** | **v3** |
| Branch | `master` | `v3` |
| Code | `src/` (repo root) | `v3/` |
| Stack | JS · Vue 2 · Vuetify · Webpack · Sizzle | TS · Vue 3 · Quasar · WXT · Vite |

They are independent trees with separate `package.json`s and toolchains. **Never mix them in one
change.** v3 work goes on the `v3` branch, inside `v3/`.

> **Until the `v3` branch merges, `v3/` and `docs/v3/` exist only on that branch** — `git checkout v3` before
> looking for anything below. This file is on `master` so the orientation is available from either side.

## v3 — the rewrite

On the `v3` branch. Read `docs/v3/PRD.md` (owns *what*) before changing behaviour, and `docs/v3/REWRITE-PLAN.md` (owns
*how*) before changing architecture. `docs/v3/SESSION-CONTEXT.md` is the history — why the project
exists and what was decided. Spike evidence is in `docs/v3/spikes/`.

**Status:** Phase 0 (de-risk) and Phase 1 (Chrome-only core) are done. **Next is Phase 2 — generators**
(Playwright-Python, Selenium Java/C#/Python, Puppeteer). Roadmap: `REWRITE-PLAN.md` §12.

Run everything from `v3/` — it is self-contained:

```
npm test          # unit + engine bundle + build + Playwright (the gate)
npm run dev       # WXT dev server
npm run typecheck # strict TS over the pure core
```

### Constraints that bind v3

- **No LLM in the critical path.** Locators are computed deterministically from published a11y specs.
  This was measured, not assumed (`REWRITE-PLAN.md` §1, §11). Fully offline, no network.
- **Cross-browser.** Chrome + Firefox. WXT emits MV3 for Chrome, MV2 for Firefox. Firefox has no side
  panel — hence side panel *and* DevTools panel, user's choice.
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

- `v3/.github/workflows/` is **inert** — GitHub only reads `.github/` at the repo root. Merge it with
  the root CI when v3 is ready to build.
- Build output is gitignored (`/v3/.output`, `/v3/.wxt`, `/v3/.test-dist`, `/v3/test-results`).
- `v3/` output sizes are small by design; WXT 0.21 emits little runtime boilerplate.

## Conventions

- **Docs: succinct.** No verbose prose, no repetition. Less is more.
- Commit messages state what changed and why; no filler.
