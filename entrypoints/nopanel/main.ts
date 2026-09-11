import { browser } from 'wxt/browser';

// The action popup for a browser with no side panel API (SPEC §15).
//
// Static markup with three things filled in here, because MV3 forbids an
// inline script: the version, the DevTools shortcut for this platform, and the
// two links. v2.5.1 did exactly the same, and this is its popup.

/** Where Support goes — the repository, as in v2.5.1 and the context menu. */
const SUPPORT_URL = 'https://github.com/danhumphrey/page-modeller';

/**
 * The DevTools shortcut, per platform. macOS is the odd one; everywhere else
 * Chromium uses Ctrl+Shift+I.
 *
 * `userAgentData.platform` is the supported reading and `navigator.platform`
 * the deprecated one, so try the first and keep the second as the fallback —
 * Firefox never sees this page, but a Chromium fork may lag on either.
 */
function shortcutKeys(): string[] {
  const ua = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform;
  const mac = ua ? ua === 'macOS' : /Mac/i.test(navigator.platform);
  return mac ? ['Command', 'Option', 'I'] : ['Control', 'Shift', 'I'];
}

const version = document.getElementById('version');
if (version) version.textContent = browser.runtime.getManifest().version;

const keys = document.getElementById('keys');
if (keys) {
  shortcutKeys().forEach((key, i) => {
    if (i > 0) {
      const plus = document.createElement('span');
      plus.className = 'plus';
      plus.textContent = '+';
      keys.append(plus);
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    keys.append(kbd);
  });
}

document.getElementById('support')?.addEventListener('click', (e) => {
  e.preventDefault();
  void browser.tabs.create({ url: SUPPORT_URL });
  window.close();
});

// Chrome puts Options on the action's own context menu, so the extension does
// not add one there (SPEC §15) — but that menu is a right-click away and this
// popup is what a left-click gets, so the link belongs here as it did in 2.5.1.
document.getElementById('options')?.addEventListener('click', (e) => {
  e.preventDefault();
  void browser.runtime.openOptionsPage();
  window.close();
});
