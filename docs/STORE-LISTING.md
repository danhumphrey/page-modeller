# Store listing copy

Drafts for both stores, following the existing listings rather than replacing them: the same voice,
the same structure, with the framework list corrected and 3.0 accounted for. Dan's to edit.

## Name

**`Page Modeller (Playwright, Selenium, Puppeteer etc.)`**

Was `Page Modeller (Selenium, Robot Framework etc)`. Robot Framework and Protractor are no longer
generated, and Playwright leads because it is what most people search for now. AMO shows the name
without the parenthetical, as it does today.

## Summary

Chrome (132 characters max; this is 74):

> Browser DevTools extension for modelling web pages for automation.

AMO, which allows more:

> Page Modeller enables developers to scan a web page and generate page object style code for various
> tools, languages and frameworks.

Both keep today's wording. **One thing to settle:** Chrome currently says *modeling*, AMO says
*modelling*. They should agree — the extension is called Page Modeller, so UK spelling throughout.

## Description

Shared by both stores.

> Browser DevTools extension for modelling web pages for automation.
>
> Pick an element on any page — or scan a whole form at once — and Page Modeller names it, works out a
> locator that resolves to it, and generates page object style code you can paste into your tests.
>
> Currently generates code for:
>
> - Playwright (TypeScript)
> - Playwright (Python)
> - Selenium WebDriver Java
> - Selenium WebDriver C#
> - Selenium WebDriver Python
> - Puppeteer
>
> Each target offers a full page object or just the locators, so it fits whatever conventions your
> project already has.
>
> Version 3 is a complete rewrite. It runs in Chrome and Firefox, works inside iframes, prefers
> accessible roles and names over brittle CSS paths, and checks that every locator it gives you
> actually resolves to the element you picked.
>
> Suggestions and bug reports are welcome on GitHub:
> https://github.com/danhumphrey/page-modeller/issues

**To settle:** today's listings both say "actively developed and is considered a beta release". After
a rewrite released as 3.0.0, that reads as less confidence than the work deserves — suggest dropping
it. Kept out of the draft above.

## What's new (3.0.0)

> A complete rewrite.
>
> - **Playwright support**, TypeScript and Python, generating role- and label-based locators
> - **Selenium WebDriver Python**, alongside Java and C#
> - **Works inside iframes**, including cross-origin and sandboxed ones
> - **Two output shapes** per framework: a full page object, or locators only
> - **Firefox support** alongside Chrome
> - Locators are checked against the page as they are generated, and the eye shows you what a locator
>   matches before you trust it
>
> Removed: Robot Framework and Protractor, both of which are no longer maintained upstream.
>
> Your options carry over. Models were never saved between sessions and still are not.

## Chrome: permission justifications

CWS asks for these in writing, and broad host permissions slow review. Keep them short and literal.

**Single purpose**

> Generate page object code for test automation from elements the user picks on a web page.

**`<all_urls>` host permission**

> Page Modeller reads the DOM of the page the user is modelling, to compute locators for the elements
> they pick. Which page that is cannot be known in advance — it is whichever page the user opens the
> panel on — so the extension needs access to any page the user chooses to model. It reads only the
> page structure, and only while the user is actively picking or previewing a locator.

**`storage`**

> Stores the user's settings, and the in-progress model for the current tab. Settings are the small
> set on the options page; the model is discarded when the panel closes.

**`scripting` / `activeTab`**

> Used to highlight the element under the cursor while picking, and to show which elements a locator
> matches.

**Data use disclosures**

> No data is collected, transmitted, or sold. The extension makes no network requests of any kind;
> everything it does happens in the browser. This matches the `data_collection_permissions: none`
> already declared for Firefox.

## Categories and links

Unchanged: Chrome **Developer Tools**; AMO **Web Development** and **Other**. Homepage and support
both the GitHub repository, as today.
