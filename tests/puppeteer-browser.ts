import puppeteer, { type Browser } from 'puppeteer-core';
import { chromium } from '@playwright/test';

/**
 * A Puppeteer browser, launched the one way that works everywhere.
 *
 * Two things are easy to omit and fail only on CI:
 *
 *   * Chrome's sandbox needs kernel privileges a CI container does not grant.
 *     Playwright passes the flags for us; puppeteer-core does not, and the
 *     failure is a SIGABRT with `No usable sandbox!` rather than anything that
 *     names the cause.
 *   * The executable is Playwright's bundled Chromium, so no second browser
 *     download is needed.
 *
 * Shared because writing the launch by hand a second time is exactly how the
 * shadow probe came to pass locally and fail on CI.
 */
export function launchPuppeteer(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: chromium.executablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}
