# Privacy policy

**Page Modeller collects no data, transmits no data, and sells no data.**

The extension makes **no network requests of any kind**. Everything it does happens inside your
browser, on your machine. There is no server, no analytics, no telemetry, no crash reporting and no
account.

Last updated: 15 September 2026, for version 3.0.0.

## What it reads

To do its job — working out a locator for an element you pick — Page Modeller reads the structure of
the page you are modelling: its elements, their attributes, their accessible roles and names, and the
text they display. It reads that page only while you are using the extension on it, and only in order
to compute a locator and to highlight which elements a locator matches.

**None of it is sent anywhere.** It is used to produce the code shown in the panel, which stays on
your machine until you copy it.

## What it stores

| What | Where | Lifetime |
|---|---|---|
| Your settings from the options page | `storage.sync` | Until you change them |
| The model you are building for a tab | `storage.session` | Discarded when the panel closes; never written to disk |

Your settings are a handful of preferences — the framework you generate for, whether tooltips show,
the test-id attribute name, the theme. **One honest note:** `storage.sync` is your browser's own sync
mechanism, so if you have browser sync switched on, your browser — not this extension — may copy those
preferences to your Google or Mozilla account, as it does for your bookmarks. Page Modeller neither
performs nor can observe that.

The model, including any page content captured in a locator, lives in session storage. It is held in
memory, is cleared when your browser closes, and is discarded when the last panel watching that tab is
closed.

## Permissions, and why

| Permission | Why |
|---|---|
| `<all_urls>` | To read the page you are modelling. Which page that is cannot be known in advance — it is whichever page you open the panel on. |
| `activeTab` | To act on the page you are on when you click the toolbar button, without broader access. On Firefox, host permissions are optional, and this is what lets picking work before you grant them. |
| `tabs` | The panel follows the active tab and shows that tab's model, so it needs to know which tab is active and when it navigates. |
| `storage` | The two things in the table above. |
| `contextMenus` | Options and Support entries on the extension's own toolbar icon. Nothing is added to any web page's menu. |
| `sidePanel` | The extension's main interface is a side panel. |

## Source

Page Modeller is open source. Everything above can be checked in the code:
<https://github.com/danhumphrey/page-modeller>

## Questions

Open an issue: <https://github.com/danhumphrey/page-modeller/issues>
