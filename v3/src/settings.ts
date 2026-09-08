// User settings (SPEC §14).
//
// Stored in chrome.storage.sync under the key `options`, preserving v2.5.1's
// keys so an in-place upgrade keeps the user's choices. Storage and the options
// page land with REWRITE-PLAN §12 step 13; until then these defaults are what
// the panel runs on.
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  showTooltips: boolean;
  /** v2.5.1's boolean darkMode becomes three-way, defaulting to the host. */
  theme: ThemePreference;
  /** Scan includes elements not exposed to the accessibility tree (SPEC §4). */
  modelHiddenElements: boolean;
  /** Single-click a row runs View Matched Elements (SPEC §6). */
  clickTableRowsToViewMatchedElements: boolean;
}

export const defaultSettings: Settings = {
  showTooltips: true,
  theme: 'system',
  modelHiddenElements: false,
  clickTableRowsToViewMatchedElements: false,
};
