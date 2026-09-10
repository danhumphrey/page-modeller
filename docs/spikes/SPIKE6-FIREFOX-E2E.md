# Spike 6 — Automating Firefox extension tests

**Question.** Can Playwright drive the extension on Firefox, so hand-testing stops being the only
Firefox gate? Every cross-browser bug found so far passed the Chrome suite.

**Answer: not with `playwright-webextext`.** The extension installs; its *pages* are unreachable.

## What was tried

[`playwright-webextext`](https://github.com/ueokande/playwright-webextext) (7.3k weekly downloads),
which installs an unpacked add-on over Firefox's Remote Debugging Protocol via `installTemporaryAddon`
— no signing, and no patching of Playwright's bundled Firefox. Firefox assigns a random internal UUID
per profile, so `moz-extension://` URLs were pinned with the `extensions.webextensions.uuids` pref,
which needs the stable `gecko.id` the manifest already carries.

## Result

| Navigation target | Outcome |
|---|---|
| Bogus extension UUID | fails in **2 ms** — `NS_ERROR_NOT_AVAILABLE` |
| Our pinned UUID, `sidepanel.html` | **times out** (6 s), `load` and `commit` alike |
| Our pinned UUID, a file that does not exist | times out (6 s) |
| An ordinary web page | loads in 108 ms |

The timing is the finding. Firefox rejects an unknown extension UUID instantly, so ours not being
rejected proves **the add-on installed and the UUID pref took effect**. Navigation under it then hangs:
Juggler, Playwright's Firefox protocol, never reports it. This is exactly what DuckDuckGo's
[`firefox-webext-playwright-harness`](https://github.com/duckduckgo/firefox-webext-playwright-harness)
patches `omni.ja` in place to fix — *"let Juggler interact with `moz-extension://` pages"*.

## Why content-script-only coverage is not a consolation prize

The obvious fallback is to skip the panel and test the content script. It does not work either: the
content script does nothing until a message tells it to, and sending one requires an extension context
— a panel page or the background — which is the thing that cannot be reached. The DDG harness solves
this by evaluating in the background over RDP.

It would also have caught nothing. All four Firefox bugs found by hand were panel-side:

- `browser.tabs` is undefined in a DevTools panel
- `sender.tab` is not populated for a message delivered to one
- Vue reactive proxies fail structured clone
- `sendResponse` + `return true` is not portable

## Options not taken

- **The DDG harness.** Would work — it patches Firefox precisely for this. But it is unpublished, zero
  stars, ships a privileged XPCOM extension for network interception we do not need, patches a binary
  in place, and its author writes: *"I don't recommend using this for anything important for now."*
- **WebDriver BiDi / geckodriver.** `webExtension.install` is in the [BiDi
  spec](https://w3c.github.io/webdriver-bidi/) and the limitation above is Juggler-specific, not a
  Firefox one — Marionette navigates to `moz-extension://` routinely, which is how Selenium suites test
  extension option pages. A separate runner alongside Playwright, so a real cost, but no patched
  binaries. **The remaining candidate if this becomes worth revisiting.**

## Consequence

`Playwright cannot load a Firefox extension` was imprecise and is corrected in CLAUDE.md: it loads
fine, but its pages cannot be driven. Firefox stays a hand-testing gate, and the structural unit tests
that stand in for it — scanning `ui/` for `browser.tabs`, and for Quasar utility-class collisions —
earn their place because they are the only automated cover for rules Chrome cannot exercise.
