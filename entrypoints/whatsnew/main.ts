import { devtoolsShortcut } from '@/src/shortcut';

// The only thing on this page that cannot be static: how to open DevTools
// differs by platform, and telling a Mac user to press F12 tells them something
// that does not work (see src/shortcut.ts).
//
// The markup carries "the DevTools shortcut" as its text, so a reader whose
// scripts are blocked still gets a sentence that reads, and nobody sees the
// wrong platform's keys flash before this runs.
const keys = document.getElementById('devtools-keys');
if (keys) {
  keys.replaceChildren();
  devtoolsShortcut().forEach((key, i) => {
    if (i > 0) {
      const plus = document.createElement('span');
      plus.className = 'plus';
      plus.textContent = ' + ';
      keys.append(plus);
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    keys.append(kbd);
  });
}
