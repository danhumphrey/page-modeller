# Page Modeller v3 — Behavioural Spec

Owns **what the tool does**. Derived from v2.5.1's shipped behaviour, walked through with the author
2026-09-08. Supersedes the behavioural half of `PRD.md`, which was generated from a locator spike and is
not authoritative.

Status key: **[settled]** confirmed by the author · **[inferred]** my reading, not yet reviewed ·
**[open]** not yet decided.

---

## 1. What it is

Pick elements on a page, build a table of named locators, generate code. Deterministic, no LLM, offline.

Output today is **methods only — no wrapper class**. A full page-object wrapper becomes an *option* on
generate/export later. **[settled]**

## 2. Surfaces

Chrome side panel · Firefox sidebar · DevTools panel on both. One host-agnostic app. **[built]**

## 3. Toolbar

Left to right: **Scan Page** · **Delete Model** · **framework selector** — spacer — **Add Element** ·
**Generate Code**.

Enablement: **[settled]**

| Control | Enabled when |
|---|---|
| Scan Page | no model yet |
| Delete Model | model exists |
| Framework selector | no model yet — locked once picking starts |
| Add Element | not scanning |
| Generate Code | model exists |

The framework is chosen up front and locked because locator types are framework-specific (`linkText`
does not exist in Playwright). The user knows their target before they start.

## 4. Capture

**Scan Page** — pick a *container*: the whole page or any subsection (typically a `div` or `form`). Its
**interactive descendants** enter the model. Non-interactive elements (`p`, `span`, …) are skipped. The
container itself is not added, only children. Scan is **once per model**; Add is how you extend it.

**Add Element** — pick **one** element anywhere, unscoped. Any element, interactive or not. This is how
non-interactive elements get into the model.

Both modes are **one-shot**: selecting an element stops picking. No continuous capture. **[settled]**

**What scan includes.** Descendants with an **interactive role**, filtered by
`modelHiddenElements` (§14): **[settled]**

| `modelHiddenElements` | Scan includes |
|---|---|
| **off** (default) | only elements **exposed to the accessibility tree** — i.e. not excluded by [ARIA tree exclusion](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion) (`display:none`, `visibility:hidden`, the `hidden` attribute, `aria-hidden="true"`) |
| **on** | every interactive-role descendant, regardless of a11y-tree exposure |

Off is the same rule Playwright's `getByRole` applies by default (`includeHidden: false`), so the scan
filter and the locator semantics agree by construction. Interactive-ness is already role-derived, so one
rule covers both concerns.

**Note that "what Playwright includes" is two rules, not one.** `getByRole` uses ARIA tree exclusion;
`:visible` and actionability use *"non-empty bounding box and does not have `visibility:hidden`"*. They
disagree in both directions — an `aria-hidden="true"` button is visible but unmatched by `getByRole`; a
zero-size element is not visible but is not ARIA-excluded. The scan follows `getByRole`, since that is
what it generates.

**Why the setting survives.** Add Element is *not* an escape hatch here: an element that is not rendered
cannot be hovered or clicked, so without the setting there is no way to model it at all. And these are
real page-object targets — the validation message that appears only on a failed submit, modal markup
present but hidden until opened, a collapsed accordion or inactive tab panel.

Consequence when it is on: a hidden element's generated `getByRole` locator will not resolve until the
test opens the thing, so the eye reports *0 elements match* at pick time. That reads as a broken locator
rather than an intentionally-hidden one — handled by the same mechanism as a stale model (§5).

Dropped from v2.5.1 regardless of the setting: the **occlusion test** (it scrolled the window and
restored it, per candidate element — slow, and it mutated page state mid-scan) and the **`opacity < 0.1`
rule** (neither ARIA nor Playwright treats transparency as hidden, so `opacity:0` elements are now
included).

Over-inclusion is cheap to correct: rows can be deleted after a scan.

## 5. Model lifetime

v2.5.1 never had to decide this — a DevTools panel is inherently per-tab, its model lived in panel
memory, survived navigation within that tab, and died with the panel. The side panel breaks all three
assumptions: it is per *window*, it follows the active tab, and it outlives navigation.

**One model per tab, owned by the background.** **[settled]**

| Event | Effect |
|---|---|
| Switch tab | table swaps to that tab's model |
| Navigate within a tab | model kept — may be stale |
| Close the tab | that model is gone |
| Close a panel | model survives if another panel is still on that tab |
| Close the **last panel watching a tab** | that tab's model is dropped |
| Both surfaces open | **the same model**, and a pick in one appears in the other |

A model can therefore never be displayed against a page it was not built from. Nothing is persisted to
storage; a model is session work, not a saved artifact.

**The background owns it, and panels are views** — they render what it broadcasts and mutate it by
sending commands. Held in a panel it was one model per *panel*: a sidebar and a DevTools panel on the
same tab showed different rows, and a pick landed in whichever happened to be listening. This is also
why closing a panel no longer discards the model, which is the better behaviour anyway — closing the
sidebar should not lose the work.

The framework selection lives in the model for the same reason: two surfaces rendering one model in
different frameworks would show different locators for the same row.

**A model with no panel watching it is abandoned work.** Panels hold a `runtime.connect` port for their
lifetime and report which tab they are showing; when a panel closes, that tab's model goes unless another
panel is still on it. `onDisconnect` covers closing the sidebar, closing DevTools, and the tab hosting
them going away.

Two things this gets right that simpler rules do not:

- **Evaluated on disconnect, never on a tab change.** A side panel follows the active tab, so dropping
  whenever no panel is watching would lose tab A's model the moment you looked at tab B. Switching away
  and back must not lose work; closing the panel is what ends it.
- **Scoped to the tab the closing panel was on, not to a global count.** A global count meant a panel
  open on tab 1 kept tab 2's model alive after both of tab 2's panels had been closed.

Because scan is once-per-model (§4), a model kept across a navigation blocks scanning the new page until
it is deleted, so the panel needs to say the model has gone stale.

**Stale models and hidden elements are one problem, not two.** Both end in the eye reporting *0 elements
match* when nothing is actually wrong — the model was built on another page, or the element is
deliberately not rendered yet.

The model records the URL of the page its first element came from, and the **background** decides
staleness on `tabs.onUpdated`, because a DevTools panel cannot read the tab's URL for itself. The panel
shows a banner naming that page, with **Delete Model** to hand — the model also blocks scanning the new
page, since scan is once-per-model (§4). Navigating back makes the model current again rather than
leaving it flagged. **[settled]**

Still to do: the 0-match snackbar naming the likely reason rather than just the count. **[inferred]**

## 6. Model table

Columns: **Name** · **Locator** (`type: value`) · **Actions** (eye · pencil · trash).

Empty state: *"Scan the page or start adding elements to build the model"*.

- **Double-click a row** → Edit dialog.
- **Single-click a row** → View Matched Elements, if the setting is on. **[settled]**

## 7. Locators

Each element carries the set of locators that were **generated and matched** for it. The type dropdown
offers the **full framework list**, not just the generated ones — selecting a type with no generated
value leaves the value field **blank** for the user to type. The generated set is a convenience, never a
constraint. **[settled]**

Selenium Java types, in order: `id, linkText, partialLinkText, name, css, xpath, className, tagName`.

Adding Playwright changes the per-framework type list, not the model's shape.

## 8. View Matched Elements (the eye)

Runs the locator live against the page: highlights **every** match (yellow fill, red outline), scrolls
the **first** match into view, and reports the count in a snackbar. Highlight clears after ~3s, or
immediately on **Close** — dismissing the count takes the highlight with it, so the page is never left
marked up with no explanation. Available from the table row *and* from inside the Edit dialog, so a
locator can be tested before saving. **[settled]**

| Matches | Icon | Message |
|---|---|---|
| 1 | green tick | *1 element matches that locator* |
| 0 | red error | *0 elements match that locator* |
| >1 | amber warning | *N elements match that locator* |

**Every candidate must find the element it was generated from.** A locator can be well-formed, resolve
to something, and still be useless: `getByRole` excludes a11y-hidden elements, so a hidden button's role
candidate finds the *other* buttons; `getByText` matches the innermost element, so a `<fieldset>`'s text
candidate finds its `<legend>`. Candidates that do not find their own element are dropped rather than
offered in the Edit dialog. **[settled]**

**The count has to be the count the generated test will get.** The in-page resolver is our own
approximation of Playwright's matching, and the eye reports from it, so any drift means showing the user
a number their test will not reproduce. Three behaviours this forces, all found by asserting every
candidate against real Playwright rather than reasoning about it:

- **`exact` is honoured.** `exact: true` is case-sensitive whole-string; the default is case-insensitive
  substring. Whitespace is normalised either way — exact match still trims, and matching by text collapses
  runs and turns line breaks into spaces. Generated candidates always set `exact: true` (§12), but a
  hand-edited locator may not, and the resolver must follow the locator rather than the convention.
- **Role candidates exclude elements hidden from the accessibility tree**, since `getByRole` defaults to
  `includeHidden: false`. The same ARIA tree exclusion as §4.
- **Text candidates match the innermost element only.** Playwright matches the smallest element
  containing the text, so an ancestor whose text comes entirely from a matching descendant does not
  count — otherwise a `<fieldset>` matches alongside its `<legend>`.

## 9. Edit dialog

Title **Edit Element**. Fields: **Name** · locator **type** dropdown · the fields that type needs · eye.
CANCEL / SAVE. **[settled]**

- **Name** is required, unique within the model, and cannot contain spaces — v2.5.1's rules.
- **Type** offers the full framework list (§7). Switching to a type the engine generated fills the
  fields in; switching to one it did not leaves them blank to type.
- The **eye** tests what is currently in the fields, not what is saved, so a locator can be checked
  before committing to it. It is **disabled, along with Save, while a required field is blank** — blank
  does not mean "match anything": an empty `label` matches every control with no accessible name.
  `getByRole`'s accessible name is the one optional field, since `getByRole('navigation')` is a real
  locator.
- A hand-edited locator that happens to equal a generated one is stored as that **selection** rather
  than an override, so it keeps tracking the engine's own verification.
- `exact: true` survives editing. The dialog does not expose `exact`, so dropping it on save would
  quietly loosen the locator (§12).

## 10. Delete Model

Confirm dialog — *"Really delete the model?"* — YES / CANCEL. **[settled]**

## 11. Generate Code

Read-only view of the generated code, titled with the framework, with a **copy to clipboard** button.
Per element: a banner comment, a getter, and interaction methods keyed to what the element is. **[settled]**

```java
/*
 * TableofContents
 * ****************************
 */

public WebElement getTableofContentsElement() {
    return driver.findElement(By.cssSelector("button[class*='toc-header']"));
}

public void clickTableofContents() {
    getTableofContentsElement().click();
}
```

### Method mapping

Classification is by **computed a11y role**, not `tagName`. Five buckets: **[settled]**

| Bucket | Roles | Methods (Selenium Java shown) |
|---|---|---|
| **actionable** | button, link, menuitem, tab, option | `click{Name}()` |
| **text** | textbox, searchbox, spinbutton | `get{Name}()` · `set{Name}(String)` |
| **toggle** | checkbox, radio, switch | `get{Name}(): boolean` · `set{Name}(boolean)` |
| **select (single)** | combobox | `get{Name}Select()` · `get{Name}Text()` · `get{Name}Value()` · `set{Name}ByValue()` · `set{Name}ByText()` |
| **select (multi)** | listbox | `get{Name}Select()` · `get{Name}Texts()` · `get{Name}Values()` · `set{Name}ByValues(...)` · `set{Name}ByTexts(...)` · `deselectAll{Name}()` |
| **static** | everything else | `get{Name}()` → text |

Every element also gets a banner comment and `get{Name}Element()`.

### Fixes to v2.5.1's templates **[settled]**

1. **Role, not `tagName`.** `isClickable`/`isInteractive` keyed off `A, BUTTON, IMG, INPUT, SELECT,
   TEXTAREA`, so `<div role="button">` — ubiquitous in modern UIs — got no `click()` and fell through to
   `getText()`. Same for `role="tab"`, `role="menuitem"`, `role="option"`, `<summary>`. Conversely an
   `<a>` with no `href` was treated as a link when it has no link role.
2. **`getDomProperty("value")`, not `getAttribute("value")`.** The attribute is the *initial* value; it
   does not change as the user types. Selenium 4.5+ exposes the live DOM property.
3. **`clear()` before `sendKeys()`.** The setter appended to existing content.
4. **`img` is static, not clickable.** It was in both `isClickable` and `isInteractive`, so images got
   `click{Name}()` and no text accessor. The accessor must read **`alt`** (or the accessible name) —
   `getText()` returns an empty string for an image.
5. **Radio `set(false)` was a no-op.** Clicking a checked radio does not uncheck it.

6. **Multi-selects were silently wrong.** On a `<select multiple>`, `selectByValue()` *adds* to the
   selection rather than replacing it, so the generated `set{Name}ByValue()` left prior selections in
   place; and `getFirstSelectedOption()` returned one option out of N. See below.

### Selects **[settled]**

Role already separates them: per HTML-AAM a `<select>` with `multiple` or `size > 1` is **`listbox`**, a
plain one is **`combobox`**. Multi setters call `deselectAll()` first, so `set` means set. Collections are
**varargs** — reads best at the call site and maps cleanly to C# `params` and Python `*values`.

```java
public void setToppingsByValues(String... values) {
    Select s = getToppingsSelect();
    s.deselectAll();
    for (String v : values) s.selectByValue(v);
}
```

`deselectAll{Name}()` is emitted for `listbox` only — `deselectAll()` throws
`UnsupportedOperationException` on a single-select.

**Role decides which methods; tag decides whether the `Select` helper is usable.** Selenium's `Select`
requires a real `<select>` (`new Select(div)` throws `UnexpectedTagNameException`), and Playwright's
`selectOption()` has the same constraint. A custom `<div role="combobox">` or `role="listbox"` therefore
falls back to **actionable** methods — `click{Name}()` to open, with the options modelled as their own
elements. Revisit if a real DOM turns up that needs better. **[settled]**

`role="slider"` joins the **text** bucket: it carries a value, and both Selenium and Playwright set it
through the element rather than a dedicated API. **[inferred]**

Also: the templates emit a stray leading space on every line.

### Locator lists per framework

Selenium Java / C# / Python: `id, linkText, partialLinkText, name, css, xpath, className, tagName`.
Puppeteer: `css, xpath`. Robot Framework and Protractor are dropped.

Playwright: `testId, role, label, placeholder, text, altText, title, css, xpath` **[inferred]** — the
engine's existing ranking, testId first as the most change-resistant.

## 12. Playwright

### Locator shape **[settled]**

A locator is a **type plus the fields that type needs**, not a flat `type: value` pair — `getByRole`
takes a role *and* a name. The table's Locator column renders the framework expression; the Edit dialog
shows the fields the chosen type requires, and the eye tests whatever is currently in them.

```
TABLE
  SignIn      getByRole('button', { name: 'Sign in' })
  Email       getByLabel('Email address')

EDIT (type = role)          EDIT (type = css)
  Type  [ role      v ]       Type  [ css       v ]
  Role  [ button      ]       Value [ button.submit ]  (eye)
  Name  [ Sign in     ]  (eye)
```

Selenium is unaffected — all its types stay single-field.

### Disambiguation **[settled]**

When role+name matches more than one element, **scope under an ancestor** — Playwright's own idiom, and
far more durable than a positional index or a generated CSS path.

```js
// Two "About" links — nav and footer
page.getByRole('navigation').getByRole('link', { name: 'About', exact: true })
page.getByRole('contentinfo').getByRole('link', { name: 'About', exact: true })
```

The engine walks up to the nearest landmark or uniquely-identifiable ancestor and verifies that ancestor
is itself unique. Scoping cannot save a genuinely repeated element — the delete button in the third table
row — so the full chain is **scope → `.nth()` within the scope → CSS/XPath**, the tail being
**[inferred]**.

### Name matching **[settled]**

Always emit `exact: true`. The engine certifies uniqueness at pick time and substring matching
undermines that afterwards: a later "About us" link turns a unique `About` locator into an ambiguous
one. `exact` still trims surrounding whitespace. A renamed element then fails loudly rather than
drifting onto the wrong target.

### Method bodies **[inferred]**

Not a substitution of the Selenium templates; the API differs enough to change shape.

| Bucket | Playwright |
|---|---|
| element | `get{Name}()` returns a lazy `Locator` — no staleness, no explicit waits |
| actionable | `await get{Name}().click()` |
| text | `fill(value)` — one call, replaces `clear()` + `sendKeys()`; read with `inputValue()` |
| toggle | `check()` / `uncheck()` / `isChecked()` — real primitives, so no click-to-toggle dance |
| select (single) | `selectOption(value)` |
| select (multi) | `selectOption([...])` — one call, no `deselectAll` loop |
| static | `textContent()` |

Two v2.5.1 bugs cannot occur here: `fill()` clears first by construction, and radio `set(false)` is
expressible only as `uncheck()`, which Playwright rejects on a radio rather than silently doing nothing.

All methods are `async`; TypeScript returns `Promise<...>`. Methods reference a bare `page`, mirroring
how the Selenium templates reference a bare `driver` — the surrounding class supplies it. **[inferred]**

### Test IDs **[inferred]**

`testId` ranks first: it is only ever a candidate when the attribute is actually present, so preferring
it costs nothing for teams who do not use test IDs, and a team that added one clearly means it to be
used. The attribute name is configurable (default `data-testid`).

`getByTestId` resolves against Playwright's own `testIdAttribute` config, so a project using `data-qa`
must set `testIdAttribute: 'data-qa'` in `playwright.config` or the generated call will not resolve. The
code dialog carries a one-line note whenever the model uses `testId` and the configured attribute is not
the default `data-testid`. **[inferred]**

## 13. Naming

Derived, with fallbacks. v2.5.1 uses an ordered rule list (first non-empty wins) then cleans and formats.
Four agreed changes: **[settled]**

1. **Fix the word-boundary bug.** `cleanName` strips whitespace *before* camelCase runs, destroying word
   boundaries — hence `TableofContents` and `DocumentUploadandQuery`. Case first, then strip:
   `TableOfContents`, `DocumentUploadAndQuery`.
2. **Use the computed accessible name** (`dom-accessibility-api`) in place of the hand-rolled label /
   `aria-label` rules, which are a partial reimplementation of accname. **The text-content rule stays**,
   ranked just below it: accname derives a name from content only for roles that support it, so a plain
   `<span>` or `<div>` computes to nothing — and those are exactly what Add Element captures (§4).
   Capped at 80 characters, since a container's `textContent` can be most of the page.
3. **Rank the accessible name above `name` and `id`.** Today a button with `id="btn-1"` and text
   "Submit" is named `Btn1`; what a human calls the element should win.
4. **Drop the ng-model and ng-binding rules.**

Keep v2.5.1's **plain names** — `About`, not `AboutLink`. No role suffix; the user can rename before
exporting.

**Build-generated identifiers are skipped**, in both the class-name and `id` rules. `Xtvsq51` is not a
name anyone would choose, and it changes on the next build of the site under test. Detected by known
CSS-in-JS shapes (emotion, styled-components, CSS Modules, leading-underscore hashes, React `useId`) and
by a run of four or more consonants, which real words and abbreviations — `btn`, `nav`, `col` — stay
under. Deliberately conservative in the cheap direction: a false positive only falls through to the next
rule, while a false negative ships a name that rots. **[settled]**

De-dupe by counter: a second `About` becomes `About2`.

Name churn versus v2.5.1 is acceptable — no stored model survives the upgrade, so nothing breaks.

Truncation runs to the nearest **word boundary** at or under 25 characters, rather than cutting
mid-word as v2.5.1 does. **[inferred]**

## 14. Settings

Stored in `chrome.storage.sync` under the key `options`. Defaults as shipped: **[settled]**

| Key | Default | Effect |
|---|---|---|
| `showTooltips` | `true` | Tooltips on toolbar and row action buttons |
| `darkMode` | `false` | Dark theme for the panel |
| `modelHiddenElements` | `false` | Include non-visible elements when scanning |
| `clickTableRowsToViewMatchedElements` | `false` | Single-click a row highlights matches |

### v3 changes **[settled]**

- **`modelHiddenElements` is kept, redefined.** Off (default) = exposed to the accessibility tree, which
  matches `getByRole`. On = include interactive-role elements regardless. See §4 — including why it is
  not redundant with Add Element. The occlusion and opacity tests behind the old definition are dropped.
- **`darkMode` becomes a three-way theme: System / Light / Dark, defaulting to System.** v2.5.1 had to ask
  because it could not know; v3 can — `chrome.devtools.panels.themeName` in the DevTools panel,
  `prefers-color-scheme` in the side panel and sidebar. The panel matches DevTools when docked there
  without anyone touching a setting.
- `showTooltips` and `clickTableRowsToViewMatchedElements` carry over unchanged.

Options page is a full tab (`options_ui.open_in_tab`), titled *Page Modeller Options*, one toggle per row.

For reference, **hidden** in v2.5.1 (`dom.isVisible`) meant: `display: none`, `visibility !== visible`,
`opacity < 0.1`, `input[type=hidden]`, or occluded by another element at its centre point. Superseded by §4.

## 15. Toolbar-icon popup

v2.5.1 shows a popup: version, *"To use the Page Modeller extension, please open DevTools"* with a
platform-aware shortcut (`Command+Option+I` on Mac, `Control+Shift+I` elsewhere), and **SUPPORT** →
the GitHub repo, **OPTIONS** → `runtime.openOptionsPage()`.

Its reason for existing — DevTools being the only surface — is gone in v3. **The popup is dropped: the
toolbar click opens the panel** (side panel on Chrome, sidebar toggle on Firefox). Support moves into the
panel; Options stays reachable via the browser's own extension menu. **[settled]**

## 16. Frames

New in v3 — v2.5.1 has no frame support. An element records the **frame path**: the ordered list of
iframes containing it, each identified by its own generated locator.

### Playwright

Stateless and chains, composing with §12 scoping. Nothing special needed.

```js
page.frameLocator('#checkout').getByRole('button', { name: 'Pay', exact: true })
```

### Selenium **[settled]**

`switchTo().frame()` mutates driver state for everything after it, so generated methods are
**self-contained**: switch to default content, switch into the frame chain, act, switch back. Every
method then works standalone regardless of call order, which is what makes generated code safe to paste.

```java
public void clickPay() {
    driver.switchTo().defaultContent();
    driver.switchTo().frame(driver.findElement(By.id("checkout")));
    driver.findElement(By.cssSelector("button.pay")).click();
    driver.switchTo().defaultContent();
}
```

**Consequence: in-frame elements get action methods, not an element getter.** A returned `WebElement`
goes stale the moment the driver switches away, so `get{Name}Element()` would hand the caller a
guaranteed-broken reference. Emit the actions only. **[settled]**

Nested frames extend the chain — one `switchTo().frame()` per level, outermost first.

## 17. Page-object wrapper

The code dialog carries a **Methods / Full page object** toggle that re-renders in place. One Generate
Code button, both outputs visible without regenerating, toolbar unchanged. **[settled]**

Methods-only stays the default (§11). The wrapper adds the class declaration, imports, and a constructor
taking the `page`/`driver` the methods already reference bare. **[inferred]**

A wrapper needs a **class name**, which methods-only does not — so the field belongs in this mode and
nowhere else. It is an editable field in the dialog, prefilled from the page title or URL path
(`/checkout` → `CheckoutPage`): right most of the time, always overridable. **[inferred]**

## 18. Still open

Nothing is unanswered. What remains is everything marked **[inferred]** — decisions taken on my reading
rather than confirmed, flagged so they are visible rather than silent:

| § | Inferred |
|---|---|
| 5 | Stale-model banner + reason on the 0-match snackbar |
| 11 | `role="slider"` → text bucket |
| 11 | Playwright locator type list and its ranking |
| 12 | Playwright method bodies; bare `page` reference; `testId` first; `testIdAttribute` note |
| 12 | `.nth()` as the tail of the disambiguation chain |
| 13 | Truncation at a word boundary |
| 17 | Wrapper constructor shape; class name prefilled from title/URL |

**Release blocker, unrelated to behaviour:** the real AMO `gecko.id` (see `PRD.md` NFR-6).
