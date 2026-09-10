import type { InjectionKey } from 'vue';

export type SurfaceKind = 'sidepanel' | 'devtools';

/**
 * The panel UI is host-agnostic: the same app runs in a Chrome side panel, a
 * Firefox sidebar and a DevTools panel on both. Everything that differs between
 * those surfaces is behind this interface.
 */
export interface PanelHost {
  readonly kind: SurfaceKind;
  /** Shown in the header so the surfaces are distinguishable while hand-testing. */
  readonly label: string;
  /** The tab this panel drives, or undefined when there isn't one. */
  getTabId(): Promise<number | undefined>;
  /** Fires when the driven tab changes. A side panel follows the active tab; a DevTools panel never moves. */
  onTabChanged(cb: (tabId: number | undefined) => void): void;
}

export const hostKey: InjectionKey<PanelHost> = Symbol('page-modeller-host');
