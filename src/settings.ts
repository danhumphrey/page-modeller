// User settings (SPEC §14).
//
// Stored in chrome.storage.sync under the key `options`, preserving v2.5.1's
// key and names so an in-place upgrade keeps the user's choices (NFR-6).
import { browser } from 'wxt/browser';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  showTooltips: boolean;
  /** v2.5.1's boolean darkMode becomes three-way, defaulting to the host. */
  theme: ThemePreference;
  /** Scan includes elements not exposed to the accessibility tree (SPEC §4). */
  modelHiddenElements: boolean;
  /** Single-click a row runs View Matched Elements (SPEC §6). */
  clickTableRowsToViewMatchedElements: boolean;
  /** Append the element's type to its derived name: `About` → `AboutLink`. */
  appendTypeToName: boolean;
  /**
   * First-use guidance, dismissed with "Don't show this again" (SPEC §4).
   * Per mode, because Add and Scan teach different things and meeting the
   * second one is a separate first time.
   */
  seenAddHelp: boolean;
  seenScanHelp: boolean;
  /**
   * The attribute a test id lives in (SPEC §12). Playwright, Cypress and
   * Testing Library all let a project choose its own, and `data-qa` and
   * `data-test` are common — with this hardcoded, those teams got no test-id
   * candidates at all and no hint as to why.
   */
  testIdAttribute: string;
}

export const defaultSettings: Settings = {
  showTooltips: true,
  theme: 'system',
  modelHiddenElements: false,
  clickTableRowsToViewMatchedElements: false,
  appendTypeToName: false,
  seenAddHelp: false,
  seenScanHelp: false,
  testIdAttribute: 'data-testid',
};

const KEY = 'options';

/** Stored settings merged over the defaults, so a new setting has a value. */
export async function loadSettings(): Promise<Settings> {
  try {
    const stored = (await browser.storage.sync.get(KEY)) as { options?: Partial<Settings> };
    return { ...defaultSettings, ...stored.options };
  } catch {
    // Sync storage can be unavailable or over quota; defaults still work.
    return { ...defaultSettings };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ [KEY]: settings });
}

/**
 * Call `onChange` whenever settings change anywhere — the options page is a
 * separate tab, so a panel cannot learn about a change any other way.
 * Returns an unsubscribe.
 */
export function watchSettings(onChange: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'sync' || !changes[KEY]) return;
    onChange({ ...defaultSettings, ...(changes[KEY].newValue as Partial<Settings> | undefined) });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
