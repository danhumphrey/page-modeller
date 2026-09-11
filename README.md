# Page Modeller

Browser DevTools extension for modelling web pages for automation.

Pick an element on any page — or scan a whole form at once — and Page Modeller names it, works out a
locator that resolves to it, and generates page object code you can paste into your tests.

Chrome and Firefox, MV3 on both. Everything is computed in the browser from the DOM and the published
accessibility rules: no LLM, no network requests, nothing leaves the page.

**Install:** [Chrome Web Store](https://chromewebstore.google.com/detail/page-modeller-selenium-ro/ejgkdhekcepfgdghejpkmbfjgnioejak)
· [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/page-modeller/)

## What it generates

| Target | Shapes |
|---|---|
| Playwright (TypeScript) | Page object · Locators only |
| Playwright (Python) | Page object · Locators only |
| Selenium WebDriver Java | Methods · Page object · Locators only |
| Selenium WebDriver C# | Methods · Page object · Locators only |
| Selenium WebDriver Python | Methods · Page object · Locators only |
| Puppeteer | Page object · Locators only |

**Locators only** is there for teams with their own page-object conventions — the locator declarations
and nothing else. No composite actions, no user-supplied templates: the point is a head start, not a
framework.

## How it picks a locator

The engine generates every strategy it can find for an element, then offers the first one that the
chosen framework can express *and* that resolves to exactly one element on the page. Accessible role
and name come first — `getByRole('button', { name: 'Log in' })`, `By.name("email")` — and a structural
CSS or XPath path is the last resort, not the default.

Where CSS is the only option it is built in the same order of preference: `[data-testid]` (the
attribute is configurable), then `[name]`, then a non-generated `#id`, then the other authored
attributes tag-qualified, then a `>` path anchored on the nearest real id.

The **eye** on each row shows what the locator actually matches, before you trust it. Elements inside
iframes carry their frame path, and the generated code enters the frames to reach them.

## Surfaces

One app, three surfaces. One `sidepanel` entrypoint gives Chrome `side_panel` and Firefox
`sidebar_action`; `devtools.html` registers the panel on both.

| | Chrome | Firefox |
|---|---|---|
| Side panel / sidebar | toolbar icon | toolbar icon (or View → Sidebar → Page Modeller) |
| DevTools panel | F12 → **Page Modeller** | F12 → **Page Modeller** |
| Options | right-click the toolbar icon | right-click the toolbar icon |

---

## Development

TypeScript · Vue 3 · Quasar · WXT · Vite. **Node 22+** (jsdom's bundled undici needs it; CI pins 24).

```
npm install
npm run dev          # Chrome, with the extension loaded
npm run dev:firefox
npm test             # the automated gate
```

> **If the dev server stops, the extension keeps running and quietly stops working.** In dev the
> manifest carries no `content_scripts` — WXT registers them at runtime and the background fetches them
> from the dev server. Kill the server and every page reports *"Page Modeller can't reach this page"*,
> and reloading the tab cannot help. Check the server before believing the extension is broken.

> **Reload the page tab after any change to the engine, content script or naming.** Re-registration
> only affects pages loaded afterwards, so a tab open across a rebuild keeps the old behaviour. Panel
> changes hot-reload, which is what makes the mix confusing.

### Scripts

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

### Loading a production build by hand

- **Chrome** — `npm run build`, then `chrome://extensions` → Developer mode → Load unpacked →
  `.output/chrome-mv3`.
- **Firefox** — `npm run build:firefox`, then `about:debugging#/runtime/this-firefox` → Load Temporary
  Add-on → `.output/firefox-mv3/manifest.json`.

The dev browser is Chrome **stable** and keeps its profile under `.wxt/`, so logins and settings
survive a restart; set `CHROME_PATH` to override, or delete `.wxt/chrome-profile` to start clean.

### Verification

**Automated tests are a net, not the criterion for done.** Firefox has no automated coverage and cannot
easily get any — Playwright installs the extension fine, but Juggler cannot navigate to
`moz-extension://` pages, so the panel is undrivable
([SPIKE6](docs/spikes/SPIKE6-FIREFOX-E2E.md)). Every cross-browser bug so far passed the Chrome suite.
Hand-test both browsers against [`docs/MANUAL-VERIFICATION.md`](docs/MANUAL-VERIFICATION.md).

What the automation does cover is the part hand-testing cannot repeat cheaply:

| | |
|---|---|
| Locator fidelity | 43 DOM edge cases resolved in real Playwright and real Puppeteer |
| Generated Python | imported and **run** — Playwright Python in a browser, Selenium Python through WebDriver |
| Generated Java / C# / TS | compiled against the real client libraries |
| The built extension | loads in Chrome and every surface renders |

`npm run fixtures` serves the pages the engine was validated on, including
`tests/fixtures/frames.html`. They are bare markup, so the failures that matter — overlays, sticky
headers, shadow roots, unusual frames — only show up on real sites.

### Docs

| | |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | **What the tool does.** Read before changing behaviour |
| [`docs/REWRITE-PLAN.md`](docs/REWRITE-PLAN.md) | **How.** Read before changing architecture |
| [`docs/MANUAL-VERIFICATION.md`](docs/MANUAL-VERIFICATION.md) | The completion gate |
| [`docs/RELEASE-PLAN.md`](docs/RELEASE-PLAN.md) | What stands between here and the stores |
| [`docs/spikes/`](docs/spikes/) | Evidence behind the decisions |

`docs/PRD.md` predates the spec and is **not authoritative for behaviour**; `docs/SESSION-CONTEXT.md`
is history. Version 2.5.1 — the Vue 2 / Webpack extension this replaces — is at the `v2.5.1-final` tag.

## Licence

[MIT](LICENSE).
