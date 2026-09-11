# ![Page Modeller](public/icon/32.png) Page Modeller

> Browser DevTools extension for modelling web pages for automation.

The Page Modeller extension enables developers to scan a web page and generate page object style code
for various tools, languages and frameworks, and test the UI locators in the browser.

Current release: **3.0.0**

Supported tools and languages are:

- Playwright (TypeScript)
- Playwright (Python)
- Selenium WebDriver Java
- Selenium WebDriver C#
- Selenium WebDriver Python
- Puppeteer

## Contents

- [Browser Support](https://github.com/danhumphrey/page-modeller#browser-support)
- [Installation](https://github.com/danhumphrey/page-modeller#installation)
- [Usage](https://github.com/danhumphrey/page-modeller#usage)
- [Output](https://github.com/danhumphrey/page-modeller#output)
- [Options](https://github.com/danhumphrey/page-modeller#options)
- [Screenshots](https://github.com/danhumphrey/page-modeller#screenshots)
- [Contribute](https://github.com/danhumphrey/page-modeller#contribute)
- [License](https://github.com/danhumphrey/page-modeller#license)

## Browser Support

<p align="center">
  <img src="media/browsers.png" width="504" alt="Chrome, Firefox, Brave, Opera, Vivaldi" />
</p>

Chrome 114+ and Firefox 115+, on Manifest V3. Other Chromium browsers install from the Chrome Web
Store listing and are expected to work, but are not tested.

Page Modeller runs as a **side panel** (Chrome) or **sidebar** (Firefox), and as a **DevTools panel**
on both.

## Installation

Install the extension using the links below:

https://chromewebstore.google.com/detail/page-modeller-selenium-ro/ejgkdhekcepfgdghejpkmbfjgnioejak

https://addons.mozilla.org/en-US/firefox/addon/page-modeller/

## Usage

<p align="center">
  <a href="https://youtu.be/R2bj3Oksf9c" target="_blank"><img src="https://img.youtube.com/vi/R2bj3Oksf9c/maxresdefault.jpg" width="600" alt="Page Modeller v3 demonstration video" /></a>
</p>
<p align="center">
  Click to watch demonstration video on YouTube.
</p>

Open the side panel from the toolbar icon, or find **Page Modeller** in DevTools, then:

- **Add Element** — pick one element anywhere on the page. Hold **⌘** (or **Ctrl**) while clicking to
  keep picking, and let go on the last one. The **↑ / ↓** arrows walk the selection up and down the
  nesting when the element you want sits underneath the one you can hover.
- **Scan Page** — pick a container, such as a form, and every interactive element inside it enters the
  model at once.
- **The eye** on a row shows what that locator actually matches, before you trust it.
- **Generate Code** for the framework you chose.

Elements inside iframes are picked the same way, and the generated code enters the frames to reach
them.

## Output

Every framework offers a full page object or **locators only** — the locator declarations and nothing
else, for teams with their own page-object conventions. Selenium also offers its **methods** shape,
the getters and interaction methods v2.5.1 generated.

Locators are computed from the page itself: the accessible role and name first, then the attributes a
person actually wrote, and a structural CSS or XPath path only as a last resort. Every candidate is
checked against the page before it is offered, so a locator that matches nothing — or matches five
things — is never presented as though it matched one.

It is all deterministic and entirely offline. No LLM, no network requests, nothing leaves the browser.

## Options

Options can be configured via the browser extension options.

- Show tooltips
- Append the element type to names
- Model hidden elements
- Click a row to view matched elements
- Theme — System, Light or Dark
- Test ID attribute — `data-testid` by default; set it to whatever your test runner uses

<p align="center">
  <img src="media/popup_options.png" width="302" alt="Popup Options" />
</p>

## Screenshots

<p align="center">
  <img src="media/screen1_chrome.jpg" width="600" alt="Chrome Playwright TypeScript" />
</p>
<p align="center">
  <img src="media/screen2_firefox.png" width="600" alt="Firefox Testing Locators" />
</p>
<p align="center">
  <img src="media/screen3_chrome.png" width="600" alt="Chrome Model Elements" />
</p>
<p align="center">
  <img src="media/screen4_firefox.png" width="600" alt="Firefox Selenium WebDriver Python" />
</p>

## Contribute

### Bugs and Suggestions

If you like this extension, please :star: this repository!

Feel free to propose new functionality and additional frameworks here:
https://github.com/danhumphrey/page-modeller/issues

### Code Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) for the stack, the scripts, and how the work is verified.

1. Fork this repository
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Added some feature'`)
4. Push to your branch (`git push origin my-new-feature`)
5. Create a new Pull Request

## License

This library is distributed under the MIT license. Please see the
[LICENSE](https://github.com/danhumphrey/page-modeller/blob/master/LICENSE) file.

:point_up_2: I really should call this "licence" as I don't live in the US, but I'm adopting the MIT
spelling :wink:
