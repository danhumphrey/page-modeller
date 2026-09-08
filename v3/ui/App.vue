<template>
  <q-layout view="hHh lpR fFf">
    <q-header>
      <AppToolbar
        :framework-id="model.frameworkId"
        :has-model="model.elements.length > 0"
        :is-scanning="isScanning"
        :is-adding="isAdding"
        @update:framework-id="setFramework"
        @scan="notYet('Scan')"
        @add="toggleAdd"
        @delete-model="deleteModel"
        @generate="notYet('Generate Code')"
      />
    </q-header>

    <q-page-container>
      <q-page>
        <ModelTable
          :elements="rows"
          :click-to-highlight="settings.clickTableRowsToViewMatchedElements"
          @highlight="highlight"
          @edit="notYet('Edit')"
          @remove="removeElement"
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
import { defaultFrameworkId } from '@/src/frameworks';
import { displayLocator } from '@/src/locators/display';
import { activeCandidate, emptyModel, type TabModel } from '@/src/model';
import { isMessage, PANEL_PORT, type BackgroundToPanel, type PanelToBackground, type PanelToContent } from '@/src/messaging';
import { hostKey } from '@/host/types';
import { defaultSettings } from '@/src/settings';

// The panel is a VIEW. The background owns the model, one per tab (SPEC §5), so
// a sidebar and a DevTools panel on the same tab show the same rows and a pick
// made in one appears in both.
const $q = useQuasar();
const host = inject(hostKey)!;

// Storage and the options page arrive with REWRITE-PLAN §12 step 13; until then
// the panel runs on the defaults.
const settings = ref({ ...defaultSettings });
const tabId = ref<number | undefined>();
const model = ref<TabModel>(emptyModel(defaultFrameworkId));
const isScanning = ref(false);
const isAdding = ref(false);

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
  if (tabId.value != null) send(tabId.value, { type: 'STOP_PICKING' });
  isAdding.value = isScanning.value = false;
}

function onPanelKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !isPicking()) return;
  e.preventDefault();
  stopPicking();
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
    else if (m.type === 'HIGHLIGHT_RESULT') showMatchCount(m.count);
  }
}

// Held open for the panel's lifetime. The background counts these to know when
// the last panel has closed, at which point the session is over and the models
// go (SPEC §5). Disconnect happens on its own when the page unloads, which is
// what covers closing the sidebar or closing DevTools.
let port: { disconnect(): void; postMessage(msg: unknown): void } | undefined;

/** Tell the background which tab this panel is showing (SPEC §5). */
function reportViewing() {
  port?.postMessage({ tabId: tabId.value });
}

onMounted(async () => {
  port = browser.runtime.connect({ name: PANEL_PORT });
  tabId.value = await host.getTabId();
  reportViewing();
  if (tabId.value != null) toBackground({ type: 'GET_MODEL', tabId: tabId.value });
  // The content script listens for Escape too, but after clicking Add Element
  // focus is in the panel, so the page never sees the keydown. Cover both.
  window.addEventListener('keydown', onPanelKey, true);
  browser.runtime.onMessage.addListener(onRuntimeMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onPanelKey, true);
  browser.runtime.onMessage.removeListener(onRuntimeMessage);
  port?.disconnect();
});

host.onTabChanged((next) => {
  if (isPicking() && tabId.value != null) send(tabId.value, { type: 'STOP_PICKING' });
  isScanning.value = isAdding.value = false;
  tabId.value = next;
  reportViewing();
  model.value = emptyModel(defaultFrameworkId);
  if (next != null) toBackground({ type: 'GET_MODEL', tabId: next });
});

async function toggleAdd() {
  if (isAdding.value) return stopPicking();
  const target = tabId.value ?? (await host.getTabId());
  tabId.value = target;
  if (target == null) return;
  send(target, { type: 'START_PICKING', mode: 'add' });
  // Optimistic: TAB_UNREACHABLE resets it if the page cannot be reached.
  isAdding.value = true;
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
  if (!el || tabId.value == null) return;
  // Fire and forget; the count arrives as HIGHLIGHT_RESULT.
  send(tabId.value, { type: 'HIGHLIGHT', candidate: activeCandidate(el) });
}

function showMatchCount(count: number) {
  const tone =
    count === 1
      ? { icon: 'check_circle', color: 'positive' }
      : count === 0
        ? { icon: 'error', color: 'negative' }
        : { icon: 'warning', color: 'warning' };

  notice('matchCount', {
    ...tone,
    message: `${count} element${count === 1 ? '' : 's'} match${count === 1 ? 'es' : ''} that locator`,
    // Close takes the highlight with it, so the page is never left marked up
    // with no explanation. Only on the explicit action: a dismiss handler would
    // also fire when this notice is replaced by the next eye click, wiping the
    // highlight that click had just applied.
    actions: [{ label: 'Close', color: 'white', handler: clearHighlight }],
  });
}

function removeElement(id: string) {
  const el = model.value.elements.find((e) => e.id === id);
  if (!el || tabId.value == null) return;
  $q.dialog({
    title: 'Delete Element',
    message: `Really delete ${el.name}?`,
    cancel: true,
    ok: { label: 'Yes', flat: true },
  }).onOk(() => toBackground({ type: 'DELETE_ELEMENT', tabId: tabId.value!, id }));
}

function deleteModel() {
  if (tabId.value == null) return;
  $q.dialog({
    title: 'Delete Model',
    message: 'Really delete the model?',
    cancel: true,
    ok: { label: 'Yes', flat: true },
  }).onOk(() => toBackground({ type: 'DELETE_MODEL', tabId: tabId.value! }));
}

function notYet(what: string) {
  notice('notYet', { message: `${what} — not built yet`, icon: 'construction', timeout: 1500 });
}
</script>
