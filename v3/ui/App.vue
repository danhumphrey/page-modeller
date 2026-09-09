<template>
  <q-layout view="hHh lpR fFf">
    <q-header>
      <AppToolbar
        :framework-id="model.frameworkId"
        :has-model="model.elements.length > 0"
        :is-scanning="isScanning"
        :is-adding="isAdding"
        :show-tooltips="settings.showTooltips"
        @update:framework-id="setFramework"
        @scan="toggleScan"
        @add="toggleAdd"
        @delete-model="deleteModel"
        @generate="showCode = true"
      />
    </q-header>

    <q-page-container>
      <q-page>
        <!-- SPEC §5: a model is kept across a navigation, so it can end up
             describing a page that is no longer loaded. Say so, rather than
             leaving the user to wonder why the eye reports 0 for every row. -->
        <div v-if="model.stale" class="stale-banner" data-testid="stale-banner">
          <q-icon name="warning" size="18px" />
          <div class="stale-text">
            Built on a different page.
            <span class="stale-url" :title="model.url ?? ''">{{ model.url }}</span>
          </div>
          <q-btn flat dense no-caps size="sm" label="Delete Model" data-testid="stale-delete" @click="deleteModel" />
        </div>

        <ModelTable
          :elements="rows"
          :click-to-highlight="settings.clickTableRowsToViewMatchedElements"
          :show-tooltips="settings.showTooltips"
          @highlight="highlight"
          @edit="openEditor"
          @remove="removeElement"
        />

        <CodeDialog v-if="showCode" :model="model" @close="showCode = false" />

        <EditElementDialog
          v-if="editing"
          :key="editing.id"
          :element="editing"
          :framework-id="model.frameworkId"
          :taken-names="model.elements.filter((e) => e.id !== editing!.id).map((e) => e.name)"
          @close="editing = undefined"
          @highlight="highlightCandidate"
          @save="saveEdit"
        />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { browser } from 'wxt/browser';
import AppToolbar from './AppToolbar.vue';
import ModelTable, { type ModelRow } from './ModelTable.vue';
import EditElementDialog from './EditElementDialog.vue';
import CodeDialog from './CodeDialog.vue';
import { defaultFrameworkId } from '@/src/frameworks';
import { displayLocator } from '@/src/locators/display';
import { activeCandidate, emptyModel, type ModelElement, type TabModel } from '@/src/model';
import { isMessage, PANEL_PORT, type BackgroundToPanel, type PanelToBackground, type PanelToContent, type PickMode } from '@/src/messaging';
import { hostKey } from '@/host/types';
import { applyTheme } from './theme';
import type { LocatorCandidate } from '@/src/engine/types';
import { defaultSettings, loadSettings, watchSettings } from '@/src/settings';

// The panel is a VIEW. The background owns the model, one per tab (SPEC §5), so
// a sidebar and a DevTools panel on the same tab show the same rows and a pick
// made in one appears in both.
const $q = useQuasar();
const host = inject(hostKey)!;

// Loaded on mount and kept current: the options page is a separate tab, so a
// change there reaches the panel only through storage (SPEC §14).
const settings = ref({ ...defaultSettings });
let unwatchSettings: (() => void) | undefined;


const tabId = ref<number | undefined>();
const model = ref<TabModel>(emptyModel(defaultFrameworkId));
const isScanning = ref(false);
const isAdding = ref(false);
const editing = ref<ModelElement | undefined>();
const showCode = ref(false);

const rows = computed<ModelRow[]>(() =>
  model.value.elements.map((el) => ({
    id: el.id,
    name: el.name,
    locator: displayLocator(activeCandidate(el), model.value.frameworkId),
  }))
);

/**
 * Quasar groups identical notifications and badges a count. Each kind of notice
 * keeps one slot and replaces it.
 */
const openNotices: Record<string, (() => void) | undefined> = {};
let noticeSeq = 0;

function notice(kind: string, opts: Parameters<typeof $q.notify>[0]) {
  openNotices[kind]?.();
  openNotices[kind] = $q.notify({
    position: 'bottom',
    timeout: 3000,
    ...(opts as object),
    // A unique group per call, rather than `group: false`. Quasar groups by
    // content and badges a count; `false` did not reliably stop it, and a value
    // nothing else shares cannot be grouped with anything.
    group: `${kind}-${++noticeSeq}`,
  });
}

/** Every panel → background message. Plain data only; see send(). */
function toBackground(msg: PanelToBackground) {
  // Vue wraps reactive state in Proxies, and anything read out of a ref is one.
  // Firefox serialises messages with structured clone, which throws
  // DataCloneError on a Proxy; Chrome's path tolerates it. Messages are plain
  // data, so a JSON round-trip is an exact copy.
  void browser.runtime.sendMessage(JSON.parse(JSON.stringify(msg))).catch((err) => {
    console.error('[Page Modeller] background message failed', msg.type, err);
  });
}

/**
 * Panel → page, always via the background. `browser.tabs` is UNDEFINED in a
 * Firefox DevTools panel — only devtools.*, runtime.* and a few others are
 * granted there. Delivery failures come back as TAB_UNREACHABLE.
 */
function send(target: number, msg: PanelToContent) {
  toBackground({ type: 'RELAY_TO_TAB', tabId: target, message: msg });
}

const isPicking = () => isScanning.value || isAdding.value;

function stopPicking() {
  // Un-arm here rather than waiting for a PICKING_STOPPED echo: the frames no
  // longer send one, because the panel asking to stop already knows.
  isAdding.value = isScanning.value = false;
  if (tabId.value != null) send(tabId.value, { type: 'STOP_PICKING' });
  isAdding.value = isScanning.value = false;
}

/**
 * Keys that belong to picking, handled here as well as in the page. After
 * clicking Add Element focus is in the panel, so the page never sees them —
 * which is why the arrows did nothing at first.
 */
function onPanelKey(e: KeyboardEvent) {
  if (!isPicking() || tabId.value == null) return;

  // Only when the keystroke is not meant for something else. The listener is on
  // the capture phase, so without this it would swallow the arrows used to move
  // through the framework dropdown — which is reachable while picking, since
  // the model is still empty.
  const target = e.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], .q-menu')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    stopPicking();
    return;
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    // Swallowed even at the ends of the chain, so the panel does not scroll.
    e.preventDefault();
    send(tabId.value, { type: 'MOVE_TARGET', direction: e.key === 'ArrowUp' ? 'up' : 'down' });
    return;
  }

  if (e.key === 'Enter') {
    // Must be intercepted, not merely forwarded: the Add Element button still
    // has focus after being clicked, so an unhandled Enter would re-activate it
    // and cancel the pick instead of committing it.
    e.preventDefault();
    send(tabId.value, { type: 'PICK_TARGET' });
  }
}

/**
 * Registered on mount and removed on unmount. Registering at setup leaked a
 * listener per instance: on HMR the replaced component kept receiving.
 */
function onRuntimeMessage(msg: unknown) {
  if (!isMessage(msg)) return;
  const incoming = msg as BackgroundToPanel;
  // Everything from the background names its tab, because Firefox does not
  // populate sender.tab for a message delivered to a DevTools page.
  if (!('tabId' in incoming) || incoming.tabId !== tabId.value || tabId.value == null) return;

  if (incoming.type === 'MODEL') {
    model.value = incoming.model;
  } else if (incoming.type === 'TAB_UNREACHABLE') {
    isAdding.value = isScanning.value = false;
    notice('unreachable', {
      message: 'Page Modeller can\u2019t reach this page. Reload the tab, or try a normal http(s) page.',
      icon: 'block',
      color: 'negative',
    });
  } else if (incoming.type === 'FROM_TAB') {
    const m = incoming.message;
    if (m.type === 'PICKING_STOPPED') isAdding.value = isScanning.value = false;
    else if (m.type === 'HIGHLIGHT_RESULT') showMatchCount(m.count, m.hidden);
  }
}

// Held open for the panel's lifetime. The background counts these to know when
// the last panel has closed, at which point the session is over and the models
// go (SPEC §5). Disconnect happens on its own when the page unloads, which is
// what covers closing the sidebar or closing DevTools.
let port: { disconnect(): void; postMessage(msg: unknown): void } | undefined;
let closing = false;

/**
 * The port also drops when Chrome terminates the service worker, which it does
 * after 30 seconds of inactivity — and since Chrome 114 an open port does not
 * hold it open. Reconnect, or the panel stops being counted and the background
 * never learns which tab it is on.
 */
function connectToBackground() {
  const opened = browser.runtime.connect({ name: PANEL_PORT });
  port = opened;
  opened.onDisconnect.addListener(() => {
    port = undefined;
    if (closing) return;
    connectToBackground();
  });
  reportViewing();
}

/** Tell the background which tab this panel is showing (SPEC §5). */
function reportViewing() {
  port?.postMessage({ tabId: tabId.value });
}

onMounted(async () => {
  settings.value = await loadSettings();
  applyTheme($q, settings.value.theme);
  unwatchSettings = watchSettings((next) => {
    settings.value = next;
    applyTheme($q, next.theme);
  });

  tabId.value = await host.getTabId();
  connectToBackground();
  if (tabId.value != null) toBackground({ type: 'GET_MODEL', tabId: tabId.value });
  // The content script listens for Escape too, but after clicking Add Element
  // focus is in the panel, so the page never sees the keydown. Cover both.
  window.addEventListener('keydown', onPanelKey, true);
  browser.runtime.onMessage.addListener(onRuntimeMessage);
});

onBeforeUnmount(() => {
  closing = true;
  unwatchSettings?.();
  window.removeEventListener('keydown', onPanelKey, true);
  browser.runtime.onMessage.removeListener(onRuntimeMessage);
  port?.disconnect();
});

host.onTabChanged((next) => {
  if (isPicking() && tabId.value != null) {
    isAdding.value = isScanning.value = false;
    send(tabId.value, { type: 'STOP_PICKING' });
  }
  isScanning.value = isAdding.value = false;
  tabId.value = next;
  reportViewing();
  model.value = emptyModel(defaultFrameworkId);
  if (next != null) toBackground({ type: 'GET_MODEL', tabId: next });
});

async function startPicking(mode: PickMode) {
  const target = tabId.value ?? (await host.getTabId());
  tabId.value = target;
  if (target == null) return;
  send(target, { type: 'START_PICKING', mode, includeHidden: settings.value.modelHiddenElements });
  // Optimistic: TAB_UNREACHABLE resets it if the page cannot be reached.
  if (mode === 'scan') isScanning.value = true;
  else isAdding.value = true;
}

async function toggleAdd() {
  if (isAdding.value) return stopPicking();
  await startPicking('add');
}

/**
 * Scan is once per model (SPEC §4) — the toolbar disables it once anything has
 * been added, so this only ever starts on an empty model.
 */
async function toggleScan() {
  if (isScanning.value) return stopPicking();
  await startPicking('scan');
}

function setFramework(frameworkId: string) {
  if (tabId.value == null) return;
  toBackground({ type: 'SET_FRAMEWORK', tabId: tabId.value, frameworkId });
}

function clearHighlight() {
  if (tabId.value == null) return;
  // Every frame may clear; only the top one ever draws.
  send(tabId.value, { type: 'CLEAR_HIGHLIGHT' });
}

function highlight(id: string) {
  const el = model.value.elements.find((e) => e.id === id);
  if (!el) return;
  highlightCandidate(activeCandidate(el));
}

/** Also used by the Edit dialog, which tests what is typed, not what is saved. */
function highlightCandidate(candidate: LocatorCandidate) {
  if (tabId.value == null) return;
  // Fire and forget; the count arrives as HIGHLIGHT_RESULT.
  send(tabId.value, { type: 'HIGHLIGHT', candidate });
}

function openEditor(id: string) {
  editing.value = model.value.elements.find((e) => e.id === id);
}

function saveEdit(payload: { name: string; selectedIndex: number; override?: LocatorCandidate }) {
  if (!editing.value || tabId.value == null) return;
  toBackground({ type: 'UPDATE_ELEMENT', tabId: tabId.value, id: editing.value.id, ...payload });
  editing.value = undefined;
}

function showMatchCount(count: number, hidden = 0) {
  const tone =
    count === 1
      ? { icon: 'check_circle', color: 'positive' }
      : count === 0
        ? { icon: 'error', color: 'negative' }
        : { icon: 'warning', color: 'warning' };

  // Say when a match is hidden. Otherwise "1 element matches" with nothing
  // outlined reads as a failure, when the locator is doing exactly its job.
  const aside = hidden > 0 ? ` — ${hidden === count ? (count === 1 ? 'it is' : 'all') : hidden} hidden` : '';

  notice('matchCount', {
    ...tone,
    message: `${count} element${count === 1 ? '' : 's'} match${count === 1 ? 'es' : ''} that locator${aside}`,
    // Close takes the highlight with it, so the page is never left marked up
    // with no explanation. Only on the explicit action: a dismiss handler would
    // also fire when this notice is replaced by the next eye click, wiping the
    // highlight that click had just applied.
    actions: [{ label: 'Close', color: 'white', handler: clearHighlight }],
  });
}

/**
 * Both confirms are destructive, so the affirmative action reads as such.
 *
 * The colours are explicit because Quasar's dialog plugin defaults to
 * `isDark() ? 'amber' : 'primary'` — which made both buttons yellow against the
 * dark panel, and gave a delete confirm the same weight as any other dialog.
 */
function confirmDestructive(title: string, message: string) {
  return $q.dialog({
    title,
    message,
    cancel: { label: 'Cancel', flat: true, color: 'grey' },
    ok: { label: 'Yes', flat: true, color: 'negative' },
  });
}

function removeElement(id: string) {
  const el = model.value.elements.find((e) => e.id === id);
  if (!el || tabId.value == null) return;
  confirmDestructive('Delete Element', `Really delete ${el.name}?`).onOk(() =>
    toBackground({ type: 'DELETE_ELEMENT', tabId: tabId.value!, id })
  );
}

function deleteModel() {
  if (tabId.value == null) return;
  confirmDestructive('Delete Model', 'Really delete the model?').onOk(() =>
    toBackground({ type: 'DELETE_MODEL', tabId: tabId.value! })
  );
}

function notYet(what: string) {
  notice('notYet', { message: `${what} — not built yet`, icon: 'construction', timeout: 1500 });
}
</script>

<style scoped>
.stale-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px var(--pm-gutter);
  background: var(--pm-warning-bg);
  color: var(--pm-warning-fg);
  border-bottom: 1px solid var(--pm-rule);
  font-size: 12px;
}

.stale-text {
  flex: 1 1 auto;
  min-width: 0;
}

/* A URL is long and the panel is narrow; the full value is on the title. */
.stale-url {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
</style>
