# Manual verification

**This is the completion gate.** Automated tests are a net; nothing is done until it has been clicked
through in a real browser. Run this on **Chrome and Firefox** — Firefox has no automated coverage at
all (`spikes/SPIKE6-FIREFOX-E2E.md`), and every cross-browser bug so far passed the Chrome suite.

Two settings change what you should expect, so note where they are: the **?** in the toolbar reopens
the picking guidance, and the options page holds the rest.

> **Reload the page tab after any change to the engine, content script or naming.** Re-registration
> only affects pages loaded afterwards, so a tab open across a rebuild keeps the old behaviour. Panel
> changes hot-reload, which is what makes the mix confusing.

> **Check the dev server is still running before believing the extension is broken.** In dev the
> background holds no content-script registration at all; if the server has stopped, every page reports
> *"Page Modeller can't reach this page"* and reloading the tab cannot help.

`npm run fixtures` serves the pages below at `http://localhost:5199`. They are bare markup, so the
failures that matter — overlays, sticky headers, shadow roots, unusual frames — only show up on real
sites. Do a pass on one of those too.

## Loading

1. Extension loads with no console errors, including in the background / service-worker console.
2. Side panel / sidebar **and** DevTools panel both render, and the header names the surface.
3. Toolbar reads Scan · Delete Model · framework — spacer — Add Element · ? · Generate Code, with
   Delete Model and Generate Code disabled while the model is empty (SPEC §3).

## Picking (SPEC §4)

4. **Add Element** → hover highlights → click adds one row, then picking *stops*. Clicking again
   without pressing Add must not add a second row.
   - The overlay label is a breadcrumb ending in the target:
     `body › main › div › button (div) "Log in"`.
   - **↑ / ↓ must still walk while the guidance dialog is open** — it is on screen explaining them on
     the first use of each mode, and Quasar gives it focus, so this is the state most people meet the
     arrows in. Escape there closes the dialog; it does not stop the pick.
   - **↑ / ↓** walk the target up and down the nesting; moving the mouse starts again from the cursor.
     ↓ is a *return* path (SPEC §4): it retraces toward the element the mouse last sat on. So from a
     freshly-hovered container it does nothing — you are already at that element — and ↑ is the only
     direction with anywhere to go. Working as specced, not a bug; reaching a child means putting the
     pointer on it.
     **Enter** or a click picks the walked-to element, not what is under the pointer. The page must not
     scroll, and Enter must not re-trigger the Add Element button.
5. **Hold ⌘ (or Ctrl) while clicking** and picking stays armed for the next click; release it and the
   last click behaves normally. Decided per click, so a run of ten is one arming.
6. **First use of each mode opens the guidance dialog**, with *Don't show this again*; the page stays
   clickable behind it. The **?** opens the same guidance on demand, and then offers no dismissal.
   On a page that cannot be reached the dialog is withdrawn and **not** counted as seen — arm picking
   again on a real page and it should still appear.
7. **Scan Page** → pick a container (arrow keys help: clicking the middle of a form lands on an input)
   → its interactive descendants arrive as rows, the container itself does not, and Scan greys out
   because it is once per model.
8. **Escape** cancels either mode — with focus in the panel, and with focus in the page.
9. With **Model hidden elements** on, a scan picks up elements excluded from the accessibility tree;
   off, it does not.

> **Scan `frames.html`.** *Scanning the page…* must stay up until every frame has reported — not vanish
> as soon as the first rows appear — and must clear on its own afterwards. Then scan it again and press
> **Delete Model** while it is still running: the model must stay deleted, not reappear with a handful of
> rows from a frame that finished late.

> **Scan a big page** — a long search-results or product-listing page, not a fixture. The panel says
> *Scanning the page…* from the click until the rows land, and the page is usable again afterwards.

## The table (SPEC §6)

10. Name and locator read correctly and stay **on one line** — Name, Locator, Actions across, not
    stacked, down to the narrowest sidebar width, with the headers still visible.
    - **Drag the sidebar as narrow as it goes.** The locator column stops shrinking and the table
      scrolls sideways rather than ellipsising every row down to `css: div.`; at ordinary widths no
      horizontal scrollbar appears at all.
11. A second element deriving the same name becomes `About2`. With **Append type to name** on,
    `About` becomes `AboutLink`.
12. **Eye** highlights every match in yellow with a red outline, scrolls the first into view, and
    reports the count — green for 1, red for 0, amber for more. It clears after ~3s or at once on
    **Close**, and clicking repeatedly replaces the message rather than stacking.
13. A hidden row's eye marks its nearest visible ancestor with a dashed outline captioned *hidden
    element*, and the count says so.
14. **Edit** (pencil or double-click): **Escape closes the dialog** and **Enter activates the focused
    button** — including while a pick is still armed, which Keep picking leaves it. Blank, spaced and
    duplicate names are rejected; switching type
    fills the fields from a generated locator or blanks them; the eye tests what is **typed**, not what
    is saved, and is disabled alongside Save while a required field is blank. Save updates the row in
    **both** surfaces.
15. **Single-click a row** does nothing until `Click table rows to view matched elements` is on.
16. Row trash and Delete Model both confirm, the destructive button is red rather than amber, and the
    dialog follows the theme.

## Model lifetime (SPEC §5)

17. **Both surfaces at once** on one tab: same rows, a pick in either appears in both. Close one and
    the model survives in the other; close them all and reopen and that tab's model is gone. Check with
    a second tab modelled — closing one tab's panels must not touch the other's.
18. **Switch tabs**: the table swaps to that tab's model and back, intact.
19. **Navigate within a tab** with a model built: a banner names the page it was built on and offers
    Delete Model. Navigate back and the banner clears.

## Frames (SPEC §16) — `tests/fixtures/frames.html`, `frameset.html`

20. Pick inside each frame kind on the page: **same-origin**, **cross-origin**, **srcdoc**, and the
    **nested** frame inside the same-origin child. Each row's eye must find its element, and the
    generated code must enter the right frames to reach it.
21. **The two frames that look alike** must be distinguishable — picking in one and running the eye
    must not highlight in the other.
22. **The sandboxed frame** draws the red dashed overlay labelled *cannot be read — sandboxed* while
    hovering it. Cross it **fast as well as slowly**: entry is detected on `mouseover` because a quick
    crossing never lands a mousemove on the 2px border.
23. Scanning a page containing that frame reports *This frame is sandboxed and cannot be read in
    Firefox* rather than hanging or silently skipping it. On Chrome the same frame reads fine — this
    is the case a Chrome-only pass cannot see.
24. `frameset.html`: the legacy `<frameset>` shape, including the nested frameset, picks and resolves.

> **Scan a web component itself**, not the page around it — hover `mirrored-field` until the breadcrumb
> ends in the host, then click. It must model the field and the Submit *inside* it. Same for
> `closed-field`: nothing to model, and it must say so.

> **`shadow.html` embeds an iframe inside a web component.** A page scan must model the gift-card
> field inside it, and the eye on that row must find it — a frame inside a shadow root is still a frame
> (SPEC §16, §19).

## Generate Code (SPEC §11)

> A class name typed here belongs to **this** model. Switch tab or delete the model and the field
> goes back to the name derived from the page's URL; the chosen output shape is a preference and
> stays.

25. For **each** of the six targets: the dialog is titled with the framework, the code is read-only and
    scrolls, and Copy puts it on the clipboard.
26. The **shape selector** sits on its own row and offers that framework's shapes. The choice is
    remembered while the panel lives, and falls back to the framework's first when the new framework
    does not offer it (`Methods` means nothing to Playwright).
27. The **class name** is editable and the generated code follows it.
28. Paste at least one output into a real project and confirm it compiles or runs. The Python targets
    are the ones automated coverage reaches furthest into; Java and C# are compile-checked only.

## Settings (SPEC §14) and the icon

29. Every setting on the options page takes effect in an **already-open** panel, without reloading it.
30. **Show tooltips** off silences every tooltip in the panel and the dialogs.
31. **Theme** moves both the panel tokens and Quasar's dark mode; `System` follows the browser.
    - On `System`, a **DevTools panel follows DevTools' theme, not the desktop's** (SPEC §14). Set
      DevTools to Dark with a light desktop: the panel goes dark with it. On Firefox it follows a
      change live; Chrome has no event for it, so there it is read when the panel opens.
36. Tab through the **options page** with a screen reader on (VoiceOver: ⌘F5): every toggle, the test
    id field and the theme select announce their own label, not just "checkbox".
32. **Test id attribute** changes which attribute the CSS candidate prefers; emptied, it falls back to
    `data-testid` rather than turning test ids off.
33. Right-click the toolbar icon → Options and Support both open.
34. On **Firefox**, check `about:addons` if picking does not work: MV3 there treats `host_permissions`
    as optional and they may need granting.
