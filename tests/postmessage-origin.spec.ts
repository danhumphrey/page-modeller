import { test, expect } from '@playwright/test';

// What a targetOrigin mismatch actually does, measured — because the frame
// plumbing names the origin it derives from a frame's `src` (SPEC §16), and
// `src` says where a frame was POINTED, not where it ended up. A frame that
// redirects across origins, or has not navigated yet, is somewhere else.
//
// Reported from hand-testing as an error on chrome://extensions:
//   "The target origin provided ('https://go.example.com') does not match the
//    recipient window's origin ('https://www.example.com')."
//
// It reads like a fault. These say exactly how much of one it is.


/** An iframe that echoes anything posted to it, built in JS to dodge srcdoc quoting. */
async function echoFrame(page: import('@playwright/test').Page) {
  await page.setContent('<div id="host"></div>');
  await page.evaluate(async () => {
    const f = document.createElement('iframe');
    f.id = 'f';
    f.srcdoc =
      '<script>window.addEventListener("message", function (e) {' +
      ' parent.postMessage({ got: e.data && e.data.n }, "*"); });' +
      '<' + '/script>';
    const ready = new Promise((r) => f.addEventListener('load', r, { once: true }));
    document.getElementById('host')!.append(f);
    await ready;
  });
}

test('a mismatch drops the message — it does not throw', async ({ page }) => {
  // This is the whole question. If it threw, it would abort the loop that
  // pushes to every frame, and every frame after the offending one would
  // silently never learn where it sits — a frame with no path answers as
  // though it were the top document (SPEC §16). It does not throw.
  await echoFrame(page);

  const result = await page.evaluate(async () => {
    const win = (document.getElementById('f') as HTMLIFrameElement).contentWindow!;
    const heard: string[] = [];
    window.addEventListener('message', (e) => {
      if (e.data?.got) heard.push(e.data.got);
    });

    let threw = false;
    try {
      win.postMessage({ n: 'named-wrong' }, 'https://go.example.com');
    } catch {
      threw = true;
    }
    win.postMessage({ n: 'broadcast' }, '*');
    await new Promise((r) => setTimeout(r, 200));
    return { threw, heard };
  });

  expect(result.threw, 'no exception, so no loop to abort').toBe(false);
  // Dropped, not misdelivered: the wrong document never sees it either.
  expect(result.heard, 'only the broadcast arrives').toEqual(['broadcast']);
});

test('the broadcast fallback is what gets the path there', async ({ page }) => {
  // So the consequence of a lying `src` is one console line, not a frame left
  // without its path — the 300ms fallback delivers, and the frame is then
  // remembered so the attempt is not repeated on every later push.
  await echoFrame(page);

  const heard = await page.evaluate(async () => {
    const win = (document.getElementById('f') as HTMLIFrameElement).contentWindow!;
    const got: string[] = [];
    window.addEventListener('message', (e) => {
      if (e.data?.got) got.push(e.data.got);
    });

    // Exactly what postToFrame does: name it, and broadcast if unacknowledged.
    win.postMessage({ n: 'path' }, 'https://go.example.com');
    await new Promise((r) => setTimeout(r, 50));
    win.postMessage({ n: 'path' }, '*');
    await new Promise((r) => setTimeout(r, 200));
    return got;
  });

  expect(heard).toEqual(['path']);
});
