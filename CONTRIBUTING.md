# Contributing

TypeScript · Vue 3 · Quasar · WXT · Vite. MV3 on Chrome and Firefox, from one codebase at the repo
root. **Node 22+** — jsdom's bundled undici needs it, and every component test fails to start without
it. CI pins 24.

```
npm install
npm run dev          # Chrome, with the extension loaded
npm run dev:firefox
npm test             # the automated gate
```

## Two things that will waste an hour

> **If the dev server stops, the extension keeps running and quietly stops working.** In dev the
> manifest carries no `content_scripts` at all — WXT registers them at runtime and the background
> fetches them from the dev server. Kill the server and every page reports *"Page Modeller can't reach
> this page"*, and reloading the tab cannot help, because nothing is missing from the tab. Check the
> server before believing the extension is broken.

> **Reload the page tab after any change to the engine, content script or naming.** WXT re-registers
> the content script on rebuild, but re-registration only affects pages loaded afterwards — a tab open
> across a rebuild keeps the old behaviour. Panel changes hot-reload, which is what makes the mix
> confusing.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `dev:firefox` | WXT dev server (HMR); launches the browser with the extension loaded |
| `npm run build` / `build:firefox` | Production build (`.output/`) |
| `npm run zip` | Store-ready zips, including the Firefox sources zip |
| `npm run typecheck` | Strict TS over the pure core |
| `npm run test:unit` | Vitest — pure core plus Vue component tests |
| `npm run check:manifests` | Assert both builds emit the expected surfaces, ids and version |
| `npm run fixtures` | Serve `tests/fixtures/` at `http://localhost:5199` |
| `npm run fetch:test-deps` | One-off: Maven jars and a NuGet restore for the Java/C# compile checks |
| `npm test` | Unit + engine fidelity + both builds + manifests + Playwright E2E and run specs |

## Loading a production build by hand

- **Chrome** — `npm run build`, then `chrome://extensions` → Developer mode → Load unpacked →
  `.output/chrome-mv3`.
- **Firefox** — `npm run build:firefox`, then `about:debugging#/runtime/this-firefox` → Load Temporary
  Add-on → `.output/firefox-mv3/manifest.json`.

The dev browser is Chrome **stable**, not whatever is newest: `chrome-launcher` otherwise picks Canary
on a machine that has it, which hides exactly the version problems `minimum_chrome_version` exists to
catch. Set `CHROME_PATH` to override. The profile lives under `.wxt/` rather than being thrown away,
so settings and logins survive a restart; delete `.wxt/chrome-profile` to start clean.

## Hand-testing several branches at once

```sh
scripts/build-rc                    # every open PR against v3-rewrite
scripts/build-rc v3-foo v3-bar      # just these
```

Merges the branches onto `v3-rewrite` in a throwaway worktree, builds both
browsers, runs the manifest checks, and writes `rc/chrome` and `rc/firefox` —
both gitignored. Load those unpacked.

Worth it because the manual gate is per *combination*, not per branch: several
PRs are usually open at once, and on Firefox and the Chromium forks there is no
automation at all. A conflict aborts the build and names the branch, which is
itself a useful signal — it means two open PRs disagree.

Whatever you have checked out is untouched.

> **Remove and re-add the extension rather than reloading it.** Chromium's
> extension error list is sticky: old errors survive a reload and read as new
> ones, which is how a fixed problem looked unfixed for half an hour.

## Store screenshots

macOS only. Three scripts, because doing this by hand goes wrong in ways that are invisible until the
images are side by side.

```sh
npm run build                             # or build:firefox
scripts/setup-chrome-for-screenshots      # or setup-firefox-for-screenshots
scripts/capture-window-screenshot model-chrome
```

The setup scripts launch the browser on a **dedicated profile**, so no bookmarks bar, other extensions,
profile avatar or omnibox history reach the frame — and size the window to 1000×625, which is 1.6:1.
Load the built extension by hand as above: Chrome shows a yellow *"unsupported command-line flag"*
infobar if `--load-extension` is used, and it lands in every capture.

`capture-window-screenshot` grabs the window you click and writes a 1280×800 PNG to the Desktop
(`SHOT_DIR` to change that). It scales to fit and composites onto an opaque canvas rather than
stretching, because:

- `sips -z 800 1280` forces the dimensions and **distorts** anything not already 1.6:1 — a 1000×650
  window came out squashed about 4%, invisible until two captures are compared;
- a macOS window grab is a rounded rectangle on transparency, and Chrome's rule is *square corners, no
  padding (full bleed)*. Compositing drops the alpha with it.

1280×800 serves both stores — Chrome requires it and caps a listing at **five**; AMO takes it as its
maximum and otherwise wants the same 1.6:1. Each store should still show **its own** browser.

The window is small to work in. Build the model in a full-size window and resize just before capturing;
the model lives in `storage.session` and survives it.

## Verification

**Automated tests are a net, not the criterion for done.** Nothing is complete until it has been
exercised by hand in a real browser, on real pages. The failures that matter here — overlays, sticky
headers, shadow roots, frames, unusual markup — are ones no unit test anticipates.

**Firefox has no automated coverage and cannot easily get any.** Playwright installs the extension
fine, but Juggler cannot navigate to `moz-extension://` pages, so the panel is undrivable
([SPIKE6](docs/spikes/SPIKE6-FIREFOX-E2E.md)). Every cross-browser bug so far passed the Chrome suite.
Hand-test both browsers against [`docs/MANUAL-VERIFICATION.md`](docs/MANUAL-VERIFICATION.md).

What the automation does cover is the part hand-testing cannot repeat cheaply:

| | |
|---|---|
| Locator fidelity | 43 DOM edge cases resolved in real Playwright and real Puppeteer |
| Generated Python | imported and **run** — Playwright Python in a browser, Selenium Python through WebDriver |
| Generated Java / C# / TS | compiled against the real client libraries |
| The built extension | loads in Chrome and every surface renders |

Running the generated code is what found the bugs a compiler could not: `get_dom_property` is Java's
and C#'s spelling and does not exist in Python, and an element called Continue produced `self.continue`.

`npm run fixtures` serves the pages the engine was validated on, including `tests/fixtures/frames.html`
for the frame cases. They are bare markup, so do a pass on a real site too.

## Docs

| | |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | **What the tool does.** Read before changing behaviour |
| [`docs/REWRITE-PLAN.md`](docs/REWRITE-PLAN.md) | **How.** Read before changing architecture |
| [`docs/MANUAL-VERIFICATION.md`](docs/MANUAL-VERIFICATION.md) | The completion gate |
| [`docs/RELEASE-PLAN.md`](docs/RELEASE-PLAN.md) | What stands between here and the stores |
| [`docs/spikes/`](docs/spikes/) | Evidence behind the decisions |

`docs/PRD.md` predates the spec and is **not authoritative for behaviour**; `docs/SESSION-CONTEXT.md`
is history. Version 2.5.1 — the Vue 2 / Webpack extension v3 replaces — is at the `v2.5.1-final` tag,
and nothing in this tree builds it.

## Pull requests

Branch from **`v3-rewrite`** and target it: `gh pr create --base v3-rewrite`. `gh` otherwise defaults
to `master`, and because PRs here are squash-merged, a PR aimed at `master` collapses the entire
branch difference into it rather than the one change you meant.

For the same reason, branch from `v3-rewrite` itself rather than from whichever branch you happen to
be on — a branch cut from another branch carries commits that land again under a different identity,
and every file both touched then conflicts even though the content is identical.
