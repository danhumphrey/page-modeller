import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { chromium } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REQUIRE_FULL_SUITE } from './required';

// What actually crosses an open shadow root.
//
// SPEC §19 states a table of which strategies pierce. This is where that table
// comes from: every row is asserted against a real engine rather than read off
// the documentation, because the implementation is built to whatever this says
// and a wrong assumption here propagates into six generators.
//
// It runs first and on every change, so a browser that changes its mind breaks
// this rather than breaking a user's locators quietly.

const FIXTURE = pathToFileURL(resolve('tests/fixtures/shadow.html')).href;

test.describe('Playwright: what pierces an open shadow root', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
  });

  // The input inside <plain-field> — nothing about it is in the light DOM, so
  // any locator that finds it has pierced.
  test('the built-in getBy* engines pierce', async ({ page }) => {
    // Two twins plus the standalone, so counts say whether it pierced AND
    // whether it found every one.
    await expect(page.getByPlaceholder('Enter a coupon')).toHaveCount(3);
    await expect(page.getByLabel('Coupon code')).toHaveCount(3);
    await expect(page.getByText('Coupon code')).toHaveCount(3);
    await expect(page.getByRole('textbox', { name: 'Coupon code' })).toHaveCount(3);
  });

  test('css pierces', async ({ page }) => {
    await expect(page.locator('input[name="coupon"]')).toHaveCount(3);
  });

  test('xpath does NOT pierce', async ({ page }) => {
    // The reason §19 excludes xpath for a shadow element.
    await expect(page.locator('xpath=//input[@name="coupon"]')).toHaveCount(0);
  });

  test('a closed root is invisible to everything', async ({ page }) => {
    await expect(page.getByPlaceholder('Unreachable')).toHaveCount(0);
    await expect(page.locator('input[name="secret"]')).toHaveCount(0);
  });

  test('nested roots pierce to any depth', async ({ page }) => {
    await expect(page.getByPlaceholder('Enter a postcode')).toHaveCount(1);
  });

  test('a host selector scopes to one component', async ({ page }) => {
    // How twins are told apart: the host picks one, the rest is relative.
    await expect(page.locator('#twin-one').getByPlaceholder('Enter a coupon')).toHaveCount(1);
    await expect(page.locator('#twin-two').getByPlaceholder('Enter a coupon')).toHaveCount(1);
  });

  test('slotted light DOM needs no shadow path', async ({ page }) => {
    // It is an ordinary child of the host; only its rendering moves.
    await expect(page.locator('slotting-panel > button')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Slotted action' })).toHaveCount(1);
  });

  test('frames and shadow roots compose', async ({ page }) => {
    // No shadow-crossing syntax needed, because Playwright's css already
    // pierces: the frame inside the shadow root is addressed exactly as one in
    // the light DOM would be. `frame-host >>> iframe#in-shadow` also resolves,
    // which is why this is asserted rather than assumed — it would have read
    // as evidence that a deep combinator was required here.
    await expect(page.locator('#in-shadow')).toHaveCount(1);
    await expect(page.frameLocator('#in-shadow').getByPlaceholder('Enter a gift card')).toHaveCount(1);
  });
});

test('Puppeteer: plain css does not pierce, >>> does', async () => {
  // Driven through Playwright's bundled Chromium so this needs no separate
  // browser download, the same arrangement puppeteer.fidelity.spec.ts uses.
  const browser = await puppeteer.launch({ executablePath: chromium.executablePath(), headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(FIXTURE);

    expect(await page.$$('input[name="coupon"]')).toHaveLength(0);
    expect(await page.$$('plain-field >>> input[name="coupon"]')).toHaveLength(3);

    // Depth: two boundaries.
    expect(await page.$$('outer-panel >>> inner-field >>> input[name="postcode"]')).toHaveLength(1);
    // And whether one `>>>` spans both, which decides if the path needs every
    // host or only the outermost.
    expect(await page.$$('outer-panel >>> input[name="postcode"]')).toHaveLength(1);

    expect(await page.$$('input[name="secret"]')).toHaveLength(0);
    expect(await page.$$('closed-field >>> input[name="secret"]')).toHaveLength(0);
  } finally {
    await browser.close();
  }
});

// ── Selenium ────────────────────────────────────────────────────────────────
// The row that mattered most, because it was the one most wrong. "css only
// from a shadow root" was a reading of the WebDriver spec; six of the eight
// strategies actually work, and two of the three things this asserts about
// closed roots contradict what the section first said.
//
// Python because it is the only Selenium runtime that installs without a
// toolchain, and because WHICH strategies survive a boundary is a property of
// the driver, not the language binding.
const PORT = 5267;
const VENV_PY = resolve('.test-venv/bin/python');
const seleniumReady = existsSync(VENV_PY);
let server: ChildProcess | undefined;

test.describe('Selenium: what survives a shadow boundary', () => {
  test.beforeAll(async () => {
    if (!seleniumReady && !REQUIRE_FULL_SUITE) return;
    server = spawn('node', [resolve('scripts/serve-fixtures.mjs')], {
      env: { ...process.env, FIXTURES_PORT: String(PORT) },
      stdio: 'ignore',
    });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`http://localhost:${PORT}/shadow.html`)).ok) return;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('fixtures server did not start');
  });

  test.afterAll(() => server?.kill());

  test('the strategies, and what a closed root really costs', () => {
    test.skip(!seleniumReady && !REQUIRE_FULL_SUITE, 'run `npm run fetch:test-deps` for the Python venv');
    expect(seleniumReady, 'PM_REQUIRE_FULL_SUITE is set but .test-venv is missing').toBe(true);

    const dir = mkdtempSync(join(tmpdir(), 'pm-shadow-'));
    const file = join(dir, 'probe.py');
    writeFileSync(
      file,
      [
        'import json',
        'from selenium import webdriver',
        'from selenium.webdriver.common.by import By',
        'from selenium.webdriver.chrome.options import Options',
        'opts = Options(); opts.add_argument("--headless=new")',
        'd = webdriver.Chrome(options=opts)',
        'out = {}',
        'def probe(k, fn):',
        '    try: out[k] = fn()',
        '    except Exception as e: out[k] = type(e).__name__',
        'try:',
        `    d.get("http://localhost:${PORT}/shadow.html")`,
        '    sr = d.find_element(By.CSS_SELECTOR, "plain-field:not(.twin)").shadow_root',
        '    probe("name", lambda: len(sr.find_elements(By.NAME, "coupon")))',
        '    probe("id", lambda: len(sr.find_elements(By.ID, "coupon-field")))',
        '    probe("linkText", lambda: len(sr.find_elements(By.LINK_TEXT, "Coupon terms")))',
        '    probe("css", lambda: len(sr.find_elements(By.CSS_SELECTOR, \'input[name="coupon"]\')))',
        '    probe("xpath", lambda: len(sr.find_elements(By.XPATH, "//input")))',
        '    probe("tagName", lambda: len(sr.find_elements(By.TAG_NAME, "input")))',
        '    probe("fromDocument", lambda: len(d.find_elements(By.NAME, "coupon")))',
        '    el = sr.find_element(By.CSS_SELECTOR, \'input[name="coupon"]\')',
        '    probe("usable", lambda: (el.send_keys("abc"), el.get_property("value"))[1])',
        '    outer = d.find_element(By.CSS_SELECTOR, "outer-panel")',
        '    probe("nested", lambda: outer.shadow_root.find_element(By.CSS_SELECTOR, "inner-field")',
        '                                  .shadow_root.find_element(By.NAME, "postcode").tag_name)',
        '    fh = d.find_element(By.CSS_SELECTOR, "frame-host")',
        '    def framed():',
        '        d.switch_to.frame(fh.shadow_root.find_element(By.CSS_SELECTOR, "iframe"))',
        '        n = len(d.find_elements(By.NAME, "giftcard"))',
        '        d.switch_to.default_content()',
        '        return n',
        '    probe("frameInShadow", framed)',
        '    closed = d.find_element(By.CSS_SELECTOR, "closed-field")',
        '    probe("closedViaWebDriver", lambda: closed.shadow_root.find_element(By.NAME, "secret").tag_name)',
        '    probe("closedViaJs", lambda: d.execute_script(',
        '        "return document.querySelector(\'closed-field\').shadowRoot"))',
        'finally:',
        '    d.quit()',
        'print(json.dumps(out))',
      ].join('\n')
    );

    const out = JSON.parse(execFileSync(VENV_PY, [file], { encoding: 'utf8' }).trim());

    // Six of eight strategies cross a boundary. Only these two do not.
    expect(out.xpath, 'xpath from a shadow root').toBe('InvalidArgumentException');
    expect(out.tagName, 'tagName from a shadow root').toBe('InvalidArgumentException');
    expect(out.name).toBe(1);
    expect(out.id).toBe(1);
    expect(out.linkText).toBe(1);
    expect(out.css).toBe(1);

    // Nothing reaches in from the document, so the chain is never optional.
    expect(out.fromDocument, 'a document-rooted find must not reach shadow content').toBe(0);

    // What it arrives at is an ordinary WebElement.
    expect(out.usable).toBe('abc');
    expect(out.nested).toBe('input');
    expect(out.frameInShadow, 'switch_to a frame found inside a shadow root').toBe(1);

    // The asymmetry §19 records: WebDriver reads a closed root, the page cannot.
    // So the limit is the picker being JavaScript, not the framework.
    expect(out.closedViaWebDriver, 'WebDriver can read a closed root').toBe('input');
    expect(out.closedViaJs, 'the page cannot').toBe(null);
  });
});
