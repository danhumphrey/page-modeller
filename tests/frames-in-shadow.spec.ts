import { test, expect } from '@playwright/test';
import { type Browser } from 'puppeteer-core';
import { launchPuppeteer } from './puppeteer-browser';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { REQUIRE_FULL_SUITE } from './required';

// Does Playwright's frameLocator really pierce to a frame a web component
// renders? The Selenium and Puppeteer generators were given a host chain to
// walk because their engines do not; Playwright was left alone because its
// engines do. That is an assumption about someone else's code, so it is
// measured here rather than asserted — the same standard SPEC §19's table was
// built to.
const FIXTURE = pathToFileURL(resolve('tests/fixtures/shadow.html')).href;

test('Playwright reaches a frame inside a shadow root with no host chain', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => !!document.querySelector('frame-host')?.shadowRoot?.querySelector('iframe'));

  // The frame is `#in-shadow`, inside <frame-host>'s open shadow root, and
  // nothing in the document can see it with an ordinary query.
  const fromDocument = await page.evaluate(() => document.querySelectorAll('#in-shadow').length);
  expect(fromDocument, 'invisible to a document-rooted query').toBe(0);

  // Playwright's css engine pierces, so the bare selector is enough.
  const framed = page.frameLocator('#in-shadow').locator('[data-spike="shadow-frame-input"]');
  await expect(framed).toHaveCount(1);
  await expect(framed).toHaveAttribute('name', 'giftcard');
});

test('and so does the host chain spelled out, which is what the table shows', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => !!document.querySelector('frame-host')?.shadowRoot?.querySelector('iframe'));

  // Either way round resolves, so carrying the chain costs Playwright nothing
  // and keeps one shape across the targets.
  const framed = page.locator('frame-host').frameLocator('#in-shadow').locator('[name="giftcard"]');
  await expect(framed).toHaveCount(1);
});

test('Puppeteer needs the host chain, and works with it', async () => {
  // The other half of the same question, and the answer is the opposite —
  // which is why it has to be asked separately per engine rather than reasoned
  // about from "it is a shadow root".
  let browser: Browser | undefined;
  try {
    browser = await launchPuppeteer();
  } catch (e) {
    const why = `puppeteer-core could not launch chromium: ${String(e).split('\n')[0]}`;
    if (REQUIRE_FULL_SUITE) throw new Error(why);
    test.skip(true, why);
    return;
  }

  try {
    const page = await browser.newPage();
    await page.goto(FIXTURE);
    await page.waitForFunction(
      () => !!document.querySelector('frame-host')?.shadowRoot?.querySelector('iframe')
    );

    // Plain css does not pierce. This is the break: `page.$` answers null, and
    // `(await page.$(sel)).contentFrame()` then throws on the null rather than
    // merely finding the wrong frame.
    expect(await page.$('#in-shadow'), 'plain css does not pierce in Puppeteer').toBeNull();

    // `>>>`, its deep descendant combinator, does — and `contentFrame()` off
    // that handle lands in the right document.
    const handle = await page.$('frame-host >>> #in-shadow');
    expect(handle, 'the deep combinator finds it').not.toBeNull();
    const frame = await handle!.contentFrame();
    expect(frame, 'and it is a frame').not.toBeNull();
    const input = await frame!.$('[data-spike="shadow-frame-input"]');
    expect(input, 'the control inside it').not.toBeNull();
  } finally {
    await browser.close();
  }
});
