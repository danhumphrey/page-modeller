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

**The overlay labels what you are about to pick**, as a breadcrumb of the nesting ending in the target:

```
body › main › div › button (div) "Continue to checkout"
```

Ancestors are role-or-tag only; the target carries its computed role, then the accessible name, with its
tag shown only when it differs from the role. It previews the locator rather than naming the tag. Capped
at three ancestors, elided with `…` beyond that. **[settled]**

**Arrow keys move the target up and down the chain** — ↑ to the parent, ↓ back towards the element under
the cursor; moving the mouse starts again from there. **Enter commits the target**, as does a click —
whichever is currently targeted, not what is under the pointer. Enter matters because hands are already
on the arrows by then, and because the Add Element button still has focus: an unhandled Enter would
re-activate it and cancel the pick.
The mouse alone cannot reliably hit a nested element: a wrapper `<div>` and the `<div role="button">`
inside it share a bounding box, so selecting the wrapper meant finding a sliver of padding. Arrow keys
are swallowed while picking even at the ends of the chain, so the page cannot scroll out from under a
pick. ↑ stops at `<body>`. **[settled]**

The panel handles these keys too, and only while picking: after clicking Add Element focus is in the
panel, so the page never receives the keydown — the same reason the panel also handles Escape. It stands
aside when the keystroke belongs to a control, since the framework dropdown is reachable while the model
is still empty.

**Scan Page** — pick a *container*: the whole page or any subsection (typically a `div` or `form`). Its
**interactive descendants** enter the model. Non-interactive elements (`p`, `span`, …) are skipped. The
container itself is not added, only children. Scan is **once per model**; Add is how you extend it.

**Add Element** — pick **one** element anywhere, unscoped. Any element, interactive or not. This is how
non-interactive elements get into the model.

Both modes are **one-shot**: selecting an element stops picking. No continuous capture. **[settled]**

**What scan includes.** Descendants that are **interactive**, filtered by `modelHiddenElements` (§14): **[settled]**

| `modelHiddenElements` | Scan includes |
|---|---|
| **off** (default) | only elements **exposed to the accessibility tree** — i.e. not excluded by [ARIA tree exclusion](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion) (`display:none`, `visibility:hidden`, the `hidden` attribute, `aria-hidden="true"`) |
| **on** | every interactive-role descendant, regardless of a11y-tree exposure |

Off is the same rule Playwright's `getByRole` applies by default (`includeHidden: false`), so the scan
filter and the locator semantics agree by construction.

**Interactive means the four buckets of §11** — actionable, text, toggle, select — so anything a scan
collects is something the generator can write methods for. `static` is deliberately excluded, or a scan
of a page would return every heading, paragraph and image on it; those go in one at a time with Add.

**Plus form controls that HTML-AAM gives no role at all.** `input[type=password]` is the one that
matters: it has no ARIA role, so a role-only rule skips it, and a scan of a login form that misses the
password field is plainly broken. The date and time family, colour and file pickers are in the same
position. `type=hidden` is excluded — never rendered, never interactive.

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

A model can therefore never be displayed against a page it was not built from. A model is session work,
not a saved artifact: it is held in `chrome.storage.session`, which lives in memory, is cleared when the
browser closes, and is never written to disk.

**Not in the background's own memory**, which is where it started. An MV3 service worker is terminated
after 30 seconds of inactivity, and since Chrome 114 an open port does not reset that timer — so every
model silently vanished after half a minute of not clicking, and appeared to come back only because
restarting the browser gave you a fresh worker. Panels reconnect their port when the worker restarts,
or the background stops knowing which tab each panel is on.

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

**The engine generates a superset** — every strategy it can find, Playwright's and Selenium's alike —
and the framework decides which are expressible. The candidate an element *starts on* is the first, in
the framework's own order of preference, that the framework can express and that resolves uniquely.

This matters more than it sounds. Without it a Selenium model selected `getByRole`, displayed it as
`role: heading — Google`, and the eye reported *1 element matches* — because the in-page resolver
understands roles even though Selenium cannot express one. A green tick on a locator that cannot exist
in the target framework is worse than no check at all. **[settled]**

Each element carries the set of locators that were **generated and matched** for it. The type dropdown
offers the **full framework list**, not just the generated ones — selecting a type with no generated
value leaves the value field **blank** for the user to type. The generated set is a convenience, never a
constraint. **[settled]**

The per-framework type lists are in §11. Adding a framework changes those lists, not the model's shape.

### What the css candidate is built from **[settled]**

CSS is not only a structural fallback. For Puppeteer it is the *only* expressible type, so the
preference the other frameworks get from their type ordering, Puppeteer can only get here. Same order:

1. `[data-testid="…"]` — most change-resistant
2. `[name="…"]` — author-chosen
3. `#id` — but only when the id does not look generated, the same rule the `id` candidate uses
4. `tag[aria-label|placeholder|alt|title|href|type="…"]` — the rest of what a person actually wrote,
   tag-qualified because `[type="submit"]` says nothing on its own and `button[type="submit"]` does
5. a `>` path, anchored on the nearest ancestor with a real id

Each step is taken only if it singles the element out, so a radio group's shared name falls through.

Without this, Facebook's email field came out as `css: #_R_1h6kqsqppb6amH1_` — a React `useId` value,
sitting next to `name="email"`. Under Selenium that was cosmetic, because its `name` type ranks first
anyway. Under Puppeteer it was the whole locator.

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

**A hidden match is still shown, and said.** With `modelHiddenElements` on (§14) a locator can resolve to
something with no box to outline, and the eye then reported *1 element matches* while drawing nothing —
a true count that reads as a failure. Such a match is marked on its **nearest visible ancestor**, dashed
rather than solid and captioned *hidden element*, so it says where on the page the thing lives without
pretending to be it. With no visible ancestor at all, a banner says how many matches have no position.
The count appends *— it is hidden* / *— N hidden*. **[settled]**

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

Confirm dialog — *"Really delete the model?"* — YES / CANCEL, with **Yes** styled as destructive.
Same for deleting a single element. **[settled]**

Both set their button colours explicitly: Quasar's dialog plugin defaults to `isDark() ? 'amber' :
'primary'`, which made a delete confirm yellow on a dark panel and gave it the same weight as any other
dialog.

## 11. Generate Code

Read-only view of the generated code, titled with the framework, with a **copy to clipboard** button.
**[settled]**

### Output shapes **[settled]**

The same locators, arranged the way that framework's users arrange them. The dialog offers the shapes
its framework has; the first is the default. Shape is a dialog-local choice — it does not touch the
model.

The selector sits on **its own row** under the title, left-aligned, taking the width it needs up to a
cap. In the sidebar there is no width to share — three shapes plus Copy beside the title truncated it to
*Seleniu…* — and at DevTools width a full-bleed segmented control reads as a banner rather than a
choice. **[settled]**

| Framework | Shapes |
|---|---|
| Selenium — Java, C#, Python | **Methods** (default) · Locators only |
| Playwright — TypeScript, Python | **Page object** (default) · Locators only |
| Puppeteer | **Page object** (default) · Locators only |

Puppeteer's page object is TypeScript, emitted by the same code as Playwright's — Puppeteer 20's
`page.locator()` is a lazy handle like Playwright's, so the shape is identical and only the import and
the selector syntax differ. Puppeteer ships its own types and its docs are TS-first; a JS user deletes
the annotations. **[settled]**

Shape ids are shared, so `Locators only` means the same thing in every framework. The choice is not
remembered between openings of the dialog. **[inferred]**

**Locators only** exists for every framework: locator declarations and nothing else, for the many teams
with their own page-object conventions. Our locators, none of our opinions — and the one output still
useful when the surrounding structure is wrong for them.

Each language declares them the way that language declares locators:

```java
private final By emailAddress = By.name("email");         // Java
```
```csharp
private readonly By _emailAddress = By.Name("email");     // C#, underscore per .NET convention
```
```python
EMAIL_ADDRESS = (By.NAME, "email")                        # Python — a locator is a tuple
```
```ts
const emailAddress = page.getByLabel('Email address', { exact: true });   // Playwright
```

User-supplied templates are deliberately **not** offered. Two shapes cover the split that matters —
take our structure, or take just the locators. **[settled]**

### Selenium's Methods shape

Per element: a banner comment, a getter, and interaction methods keyed to what the element is.
**[settled]**

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
| **text** | textbox, searchbox, spinbutton | `get{Name}()` · `set{Name}(String)` · `set{Name}(String, boolean clearFirst)` |
| **toggle** | checkbox, switch | `is{Name}Checked()` · `set{Name}(boolean)` |
| **select (single)** | combobox | `get{Name}Select()` · `get{Name}Text()` · `get{Name}Value()` · `set{Name}ByValue()` · `set{Name}ByText()` |
| **select (multi)** | listbox | `get{Name}Select()` · `get{Name}Texts()` · `get{Name}Values()` · `set{Name}ByValues(...)` · `set{Name}ByTexts(...)` · `deselectAll{Name}()` |
| **radio** | radio | `is{Name}Selected()` · `select{Name}()` |
| **static** | everything else | `get{Name}()` → text, or `get{Name}AltText()` for an image |

Every element also gets a banner comment and `get{Name}Element()`.

### Fixes to v2.5.1's templates **[settled]**

1. **Role, not `tagName`.** `isClickable`/`isInteractive` keyed off `A, BUTTON, IMG, INPUT, SELECT,
   TEXTAREA`, so `<div role="button">` — ubiquitous in modern UIs — got no `click()` and fell through to
   `getText()`. Same for `role="tab"`, `role="menuitem"`, `role="option"`, `<summary>`. Conversely an
   `<a>` with no `href` was treated as a link when it has no link role.
2. **`getDomProperty("value")`, not `getAttribute("value")`.** The attribute is the *initial* value; it
   does not change as the user types. Selenium 4.5+ exposes the live DOM property.
3. **`clear()` before `sendKeys()`.** The setter appended to existing content. Clearing is the default,
   not the only option: `set{Name}(value)` clears, `set{Name}(value, clearFirst)` does not have to.
   Swapping one hard-coded behaviour for the other would just be a different wrong default. Languages
   with default arguments express this as one method; Java needs the overload.
4. **`img` is static, not clickable.** It was in both `isClickable` and `isInteractive`, so images got
   `click{Name}()` and no text accessor. The accessor must read **`alt`** (or the accessible name) —
   `getText()` returns an empty string for an image.
5. **Radio `set(false)` was a no-op.** Clicking a checked radio does not uncheck it, so a radio gets
   `is{Name}Selected()` and `select{Name}()` — selecting is the only verb that means anything — rather
   than a `set{Name}(boolean)` half of which silently did nothing.

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

### Language idiom, not translation **[settled]**

Same decisions, each language's spelling. Where a language has a feature Java lacks, the output uses
it rather than carrying Java's workaround across:

| | Java | C# | Python |
|---|---|---|---|
| clear-before-type | two overloads | `bool clearFirst = true` | `clear_first=True` |
| varargs | `String...` | `params string[]` | `*values` |
| read a property | `getText()` | `.Text` | `.text` |
| collections | `stream().map().collect()` | `.Select().ToList()` | list comprehension |
| braces / layout | K&R | Allman | PEP 8, two blank lines |

C# `checked` is a keyword, so the toggle setter takes `isChecked`.

### Locator lists per framework

Selenium Java / C# / Python: `name, id, linkText, partialLinkText, css, xpath, className, tagName`.

**`name` ahead of `id`, unlike v2.5.1.** A name is author-chosen and essentially never
framework-generated; ids are generated constantly — React's `useId` gave Facebook's password field
`id="_r_6_"` alongside `name="pass"`. It is not only form controls that carry one — `<a>`, `<iframe>`,
`<map>` and `<object>` do too — but wherever it exists it was written by hand, which is the point. A
shared name (a radio group) is never chosen, because a candidate must resolve uniquely (§7).
Puppeteer: `css, xpath`. Robot Framework and Protractor are dropped.

**Puppeteer's P-selectors were tried and rejected.** `::-p-aria` and `::-p-text` looked like they would
buy role and text parity. `tests/puppeteer.fidelity.spec.ts` resolved them in a real Puppeteer and they
cannot be generated reliably: **[settled]**

- `::-p-text` is **substring** matching with no exact variant, so `::-p-text("Sign in")` also matched the
  heading *Sign in to your account*. §12 emits `exact: true` precisely to stop that.
- `::-p-aria([role=…])` wants **Chrome's** AX role names, not ARIA's — `img` is `image` there — and
  `role="presentation"` is not in the tree at all.
- `::-p-aria([name=…])` compares exactly against Chrome's own name string, which keeps whitespace we
  normalise away: `<a>  Read   more  </a>` is named `"Read more "`, trailing space included.

What closes the gap instead is a better css candidate (§7): `a[href="/forgot"]` rather than seven levels
of `div:nth-of-type`. XPath keeps Puppeteer's `xpath/` prefix, so an absolute path doubles the slash —
`xpath//html[1]/body[1]` is correct.

Playwright: `testId, role, label, placeholder, text, altText, title, css, xpath` **[inferred]** — the
engine's existing ranking, testId first as the most change-resistant.

These lists are also the **order of preference** for choosing an element's starting locator (§7).

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

### XPath needs its prefix **[settled]**

`page.locator('xpath=…')`, always. Playwright infers XPath only from a leading `//` or `..`; the
engine's fallback path starts with a single `/`, which is parsed as CSS and throws. Prefixed
unconditionally — `//` would survive bare, but two spellings of one thing is one more thing to get
wrong.

### Name matching **[settled]**

Always emit `exact: true`. The engine certifies uniqueness at pick time and substring matching
undermines that afterwards: a later "About us" link turns a unique `About` locator into an ambiguous
one. `exact` still trims surrounding whitespace. A renamed element then fails loudly rather than
drifting onto the wrong target.

### Page object shape **[settled]**

Not a translation of the Selenium template. `readonly` fields assigned in the constructor — the shape
Playwright's own docs show.

```ts
import { type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly emailAddress: Locator;
  readonly signIn: Locator;

  constructor(private readonly page: Page) {
    this.emailAddress = page.getByLabel('Email address', { exact: true });
    this.signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  }
}
```

**No per-element action wrappers.** A `Locator` is lazy, reusable and *is* the action API, so
`clickSignIn()` wrapping `.click()` adds a name and nothing else — `loginPage.signIn.click()` reads
better. Those wrappers earn their place in Selenium, where `findElement` returns something that goes
stale; here they are ceremony, and they multiply per bucket into a wall of code nobody asked for.

**No composite methods.** `login(email, password)` is the point of a page object and needs domain
knowledge this tool does not have. The user adds those — the tool exists to shortcut the locators.

Field names are the element name, lower-camel. Assignment reads the constructor **parameter** `page`,
not `this.page`: the parameter property is not assigned until the constructor body completes.

Class name comes from the last path segment of the model's URL — `/account/login.html` → `LoginPage`,
`facebook.com` → `FacebookPage`, no URL → `GeneratedPage`. Rename it; the tool cannot know what you call
the page. **[inferred]**

No banner comments. Field names carry the same information in a fifth of the lines.

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

Keep v2.5.1's **plain names** by default — `About`, not `AboutLink`. The user can rename before
exporting.

**`appendTypeToName`** (§14, off by default) turns the suffix on: `FeelTheMagic` becomes
`FeelTheMagicLink`. The vocabulary is the one test authors use rather than raw ARIA — `textbox`
and `searchbox` become `Input`, `combobox` and `listbox` become `Select`, `img` becomes `Image` — since
these names are read by people writing page objects. A role with no entry falls back to the role itself,
so an unmapped one still produces something sensible, and a name already ending in its type is left
alone rather than becoming `SubmitButtonButton`. Read per pick, so the setting takes effect at once.
**[settled]**

**Build-generated identifiers are skipped**, in both the class-name and `id` rules. `Xtvsq51` is not a
name anyone would choose, and it changes on the next build of the site under test. Detected by known
CSS-in-JS shapes (emotion, styled-components, CSS Modules, leading-underscore hashes, React `useId`) and
by a run of four or more consonants, which real words and abbreviations — `btn`, `nav`, `col` — stay
under. React's `useId` is covered in both its forms: `:r6:` / `«r6»` from React 18, `_r_6_` from 19. Deliberately conservative in the cheap direction: a false positive only falls through to the next
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
| `theme` | `system` | Panel theme; `system` follows the browser and DevTools |
| `modelHiddenElements` | `false` | Include non-visible elements when scanning |
| `clickTableRowsToViewMatchedElements` | `false` | Single-click a row highlights matches |
| `appendTypeToName` | `false` | Append the element's type to its derived name |

v2.5.1's `darkMode` boolean is replaced by `theme`; the rest keep their keys so an in-place upgrade
keeps the user's choices (NFR-6).

**Applying the theme moves two things**, and both surfaces go through one function: our CSS tokens,
stamped on the root, and Quasar's own dark mode, which paints its dialogs, notifications and the body
background. Setting only the first gives dark text on Quasar's dark ground.

Settings are read live — the options page is a separate tab, so a change reaches an open panel only
through `storage.onChanged`.

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
toolbar click opens the panel** (side panel on Chrome, sidebar toggle on Firefox), because a click
should get you working rather than show you a menu. **[settled]**

**Right-clicking the toolbar icon carries what the popup did**, via `contextMenus` with
`contexts: ['action']` — but only what the browser does not already offer. Chrome puts **Options** on
that menu itself (along with *Open side panel*), so adding our own would show it twice; Firefox offers
*Manage Extension*, which goes to `about:addons` rather than the options page. So **Support** on both,
**Options** on Firefox only. **[settled]**

Created on every worker start, not on install: `onInstalled` does not reliably fire when an unpacked
extension is reloaded — which is every rebuild in dev — and the menu is then simply absent.

## 16. Frames

New in v3 — v2.5.1 has no frame support. An element records its **frame path**: the frames containing
it, outermost first, each identified by its own generated locator. **[settled]**

A frame is located by the ordinary candidate machinery — the document holding an `<iframe>` is just a
document — with one restriction: **css or xpath only**. `frameLocator` takes a *selector*, not a
locator, and so does every other frame API in reach, so `getByTitle('Payment')` cannot address a frame
however well it identifies one. `cssFor` already prefers a test id, then a name, then an id (§7), so
little is lost.

`window.frameElement` builds the chain, and its limit is the hard case: it is readable only when the
parent is same-origin. Across an origin it throws, and a document cannot see what embeds it — so the
chain stops there and is **marked opaque**. A path that starts halfway down and looks complete is worse
than one that admits it is partial. **[settled]**

### Carrying it, or admitting you cannot **[settled]**

| Target | How |
|---|---|
| Playwright | `frameLocator(…)` chains, so the locator is self-contained — nothing to explain, nothing to switch |
| Selenium | a `By` is frame-agnostic: a comment names the chain and says a switch is required first |
| Puppeteer | `page.locator` is page-scoped and there is no `frameLocator`: the same comment |

Without that comment a framed Selenium or Puppeteer locator is indistinguishable from a main-frame one
and silently resolves against the wrong document.

The **model table** shows the chain for the same reason — two rows differing only by frame otherwise
read identically. The **Edit dialog** shows it too, read-only: the chain is where the element *is*, not
part of how it is found within that frame, so editing it would be editing the page.

### Scanning a frame **[settled]**

Scanning an `<iframe>` scans **inside** it. An iframe has no descendants in its parent's document — its
content is a separate document — so the obvious reading returns nothing at all, which is what it did.

The frame scans itself rather than the parent reaching in: `contentDocument` throws across an origin,
and the frame is armed already (`START_PICKING` reaches every frame) and knows its own path, so every
element comes out with the right chain for free. The parent asks via `postMessage`, the one message this
script accepts from another frame — isolated worlds do not isolate `postMessage`, so the handler also
requires that a scan is genuinely in progress and that the sender is the parent. The worst a forged
message can then do is what the user was already doing.

**A scan never crosses a frame boundary on its own.** Scanning a container that happens to hold frames
gets that document's controls and stops; the frame's contents come only when you scan the frame itself,
or something inside it. **[settled]**

Descending automatically would mean scanning `<main>` on an ordinary page could sweep in an embedded
third-party app, an ad, or a sandboxed widget nobody asked to model — and those are exactly the frames
whose locators are least likely to survive. Entering a frame is a decision, so it takes a click.

### The eye **[settled]**

Every frame hears a `HIGHLIGHT`, and exactly one must answer or a sub-frame's 0 lands on top of the real
count. The one that answers is the frame the element was picked in: each recomputes its own path and
compares. Before this, only the top frame answered, so anything inside a frame reported *0 elements
match that locator* while its locator was perfectly good.

### One picker, many frames **[settled]**

The content script runs in every frame, so `START_PICKING` arms every frame. Two rules follow, and
neither can be inferred from pointer events:

- **One-shot is per tab, not per frame.** Only the clicked frame stops itself; the background disarms
  the rest. Without that, one pick on a framed page recorded three elements as the user carried on
  clicking.
- **One overlay at a time.** A frame announces that it has drawn and the background tells the others to
  clear. A parent frame gets *no* `mouseout` when the pointer crosses into a child, so hovering down
  through nested frames otherwise left a highlight and a breadcrumb in every frame on the way.

### Fixtures **[settled]**

`tests/fixtures/frames.html` and `frameset.html`, exercising every shape a real page uses:

| Frame | Why it is there |
|---|---|
| same-origin `iframe` | the ordinary case, and it nests one deeper |
| cross-origin `iframe` | `127.0.0.1` against `localhost` — one server, two origins, no second process |
| `srcdoc` | same-origin with no URL at all; nothing to identify it by but the element |
| `sandbox="allow-scripts"` | an opaque origin, which is what a third-party widget usually is |
| two identical `iframe`s | the frame itself needs a positional locator — the case a path can get wrong |
| `frameset` / `frame` | `frame` is a different element from `iframe`; a selector for one misses the other |

**Nine buttons across the tree share the accessible name *Submit*.** Without a frame path a locator
cannot tell them apart, which is the property every frame test leans on.

The fixtures are served over http, never `file://`: Chrome gives every `file://` document an opaque
origin, so `localhost` against `127.0.0.1` would prove nothing. `scripts/serve-fixtures.mjs` substitutes
the cross-origin base at request time, so it follows `FIXTURES_PORT`. An element records the **frame path**: the ordered list of
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

## 17. Selenium page-object wrapper

A third Selenium shape — **Methods** (default) · Page object · Locators only. Imports, a class
declaration, and a constructor taking the `driver` the methods otherwise reference bare. **[settled]**

Imports are computed from the buckets present: `Select` only when there is a select, `List` and
`Collectors` only when there is a multi-select. Unused imports are legal and are also the first thing a
reviewer notices.

**Python is not a wrapper.** Java and C# have an implicit receiver, so the fragment drops into a class
unchanged. Python does not: every definition gains `self` and every call site a `self.` prefix, so the
generator is receiver-aware rather than wrapped. **[settled]**

Class name is derived as it is for Playwright (§12). Making it an **editable field** in the dialog is
the obvious next step and is not built. **[open]**

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
