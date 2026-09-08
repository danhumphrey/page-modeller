<template>
  <q-layout view="hHh lpR fFf">
    <q-header>
      <AppToolbar
        v-model:framework-id="frameworkId"
        :has-model="elements.length > 0"
        :is-scanning="isScanning"
        :is-adding="isAdding"
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
import { ModelStore, activeCandidate, type ModelElement } from '@/src/model';
import { uniqueName } from '@/src/engine/naming';
import { isMessage, type BackgroundToPanel, type ContentToPanel, type PanelToContent } from '@/src/messaging';
import { hostKey } from '@/host/types';
import { defaultSettings } from '@/src/settings';

const $q = useQuasar();
const host = inject(hostKey)!;

// Storage and the options page arrive with REWRITE-PLAN §12 step 13; until then
// the panel runs on the defaults.
const settings = ref({ ...defaultSettings });
const frameworkId = ref(defaultFrameworkId);
const tabId = ref<number | undefined>();
const isScanning = ref(false);
const isAdding = ref(false);

// One model per tab (SPEC §5). `elements` is a shallow copy of the active tab's
// list so Vue tracks it; the store owns the real thing.
const store = new ModelStore();
const elements = ref<ModelElement[]>([]);

function syncFromStore() {
  elements.value = tabId.value == null ? [] : [...store.get(tabId.value).elements];
}

const rows = computed<ModelRow[]>(() =>
  elements.value.map((el) => ({
    id: el.id,
    name: el.name,
    locator: displayLocator(activeCandidate(el), frameworkId.value),
  }))
);

onMounted(async () => {
  tabId.value = await host.getTabId();
  syncFromStore();
  // The content script listens for Escape too, but after clicking Add Element
  // focus is in the panel, so the page never sees the keydown. Cover both.
  window.addEventListener('keydown', onPanelKey, true);
  browser.runtime.onMessage.addListener(onRuntimeMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onPanelKey, true);
  browser.runtime.onMessage.removeListener(onRuntimeMessage);
});

function onPanelKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !isPicking()) return;
  e.preventDefault();
  void stopPicking();
}

host.onTabChanged((next) => {
  if (isPicking() && tabId.value != null) send(tabId.value, { type: 'STOP_PICKING' });
  isScanning.value = isAdding.value = false;
  tabId.value = next;
  syncFromStore();
});

const isPicking = () => isScanning.value || isAdding.value;

function stopPicking() {
  if (tabId.value != null) send(tabId.value, { type: 'STOP_PICKING' });
  isAdding.value = isScanning.value = false;
}

/**
 * Panel → page, always via the background.
 *
 * `browser.tabs` is UNDEFINED in a Firefox DevTools panel: a devtools page is
 * granted only devtools.*, runtime.* and a few others. Calling tabs.sendMessage
 * there throws "can't access property sendMessage, tabs is undefined", which
 * the panel reported as an unreachable page. Chrome tolerates the direct call,
 * so this failed on one surface of one browser.
 *
 * Relaying through the background works everywhere, and using it for all three
 * surfaces keeps one path rather than a working one and a broken one. Delivery
 * failures come back as TAB_UNREACHABLE — the panel cannot see the
 * background's rejection.
 */
function send(target: number, msg: PanelToContent) {
  // Vue wraps reactive state in Proxies, and anything read out of `elements` is
  // one. Firefox serialises messages with structured clone, which throws
  // DataCloneError on a Proxy; Chrome's path tolerates it. Messages are plain
  // data, so a JSON round-trip is an exact copy.
  const message = JSON.parse(JSON.stringify(msg)) as PanelToContent;
  void browser.runtime.sendMessage({ type: 'RELAY_TO_TAB', tabId: target, message }).catch((err) => {
    console.error('[Page Modeller] relay send failed', msg.type, err);
  });
}

async function toggleAdd() {
  if (isAdding.value) return stopPicking();
  const target = tabId.value ?? (await host.getTabId());
  tabId.value = target;
  if (target == null) return;
  send(target, { type: 'START_PICKING', mode: 'add' });
  // Optimistic: TAB_UNREACHABLE resets it if the page cannot be reached.
  isAdding.value = true;
}

let idSeq = 0;

/**
 * Registered on mount and removed on unmount. Registering at setup leaked a
 * listener per instance: on HMR the replaced component kept receiving, and its
 * store and refs are per-instance, so a pick could land in an instance that is
 * no longer rendered — the table simply stayed empty.
 */
function onRuntimeMessage(msg: unknown, sender: { tab?: { id?: number } }) {
  if (!isMessage(msg)) return;

  // The background has no sender.tab, so it is matched on the tab it names.
  if ((msg as BackgroundToPanel).type === 'TAB_UNREACHABLE') {
    if ((msg as BackgroundToPanel).tabId !== tabId.value) return;
    isAdding.value = isScanning.value = false;
    notice('unreachable', {
      message: 'Page Modeller can’t reach this page. Reload the tab, or try a normal http(s) page.',
      icon: 'block',
      color: 'negative',
    });
    return;
  }

  // Content traffic: only this panel's tab. Without it, a DevTools panel would
  // absorb every other tab's picks.
  if (sender.tab?.id !== tabId.value || tabId.value == null) return;
  const m = msg as ContentToPanel;

  if (m.type === 'ELEMENT_PICKED') {
    const model = store.get(tabId.value);
    model.elements.push({
      ...m.result,
      id: `el-${idSeq++}`,
      name: uniqueName(m.result.suggestedName, model.usedNames),
      selectedIndex: m.result.preferredIndex >= 0 ? m.result.preferredIndex : 0,
    });
    // Picking is one-shot (SPEC §4); the content script has already stopped.
    isAdding.value = isScanning.value = false;
    syncFromStore();
  } else if (m.type === 'PICKING_STOPPED') {
    isAdding.value = isScanning.value = false;
  } else if (m.type === 'HIGHLIGHT_RESULT') {
    showMatchCount(m.count);
  }
}

function removeElement(id: string) {
  const el = elements.value.find((e) => e.id === id);
  if (!el || tabId.value == null) return;
  $q.dialog({
    title: 'Delete Element',
    message: `Really delete ${el.name}?`,
    cancel: true,
    ok: { label: 'Yes', flat: true },
  }).onOk(() => {
    const model = store.get(tabId.value!);
    model.elements = model.elements.filter((e) => e.id !== id);
    model.usedNames.delete(el.name);
    syncFromStore();
  });
}

function deleteModel() {
  if (tabId.value == null) return;
  $q.dialog({
    title: 'Delete Model',
    message: 'Really delete the model?',
    cancel: true,
    ok: { label: 'Yes', flat: true },
  }).onOk(() => {
    store.clear(tabId.value!);
    syncFromStore();
  });
}

/**
 * View Matched Elements (SPEC §8): run the locator live, highlight every match
 * in the page, and report the count. Exactly one match is the whole point of
 * the model, so the three outcomes are visually distinct.
 */
/**
 * Quasar groups identical notifications and badges a count, so repeated clicks
 * pile up a "12". Each kind of notice keeps one slot and replaces it.
 */
const openNotices: Record<string, (() => void) | undefined> = {};
let noticeSeq = 0;

function notice(kind: string, opts: Parameters<typeof $q.notify>[0]) {
  openNotices[kind]?.();
  openNotices[kind] = $q.notify({
    position: 'bottom',
    timeout: 3000,
    ...(opts as object),
    // A unique group per call, rather than `group: false`. Quasar groups
    // notifications by content and badges a count; `false` did not reliably
    // stop it, and a value nothing else shares cannot be grouped with anything.
    group: `${kind}-${++noticeSeq}`,
  });
}

function clearHighlight() {
  if (tabId.value == null) return;
  // Every frame may clear; only the top one ever draws.
  send(tabId.value, { type: 'CLEAR_HIGHLIGHT' });
}

function highlight(id: string) {
  const el = elements.value.find((e) => e.id === id);
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
    // also fire when this notice is *replaced* by the next eye click, wiping
    // the highlight that click had just applied. Natural expiry needs no
    // handler — both timers are 3s.
    actions: [{ label: 'Close', color: 'white', handler: clearHighlight }],
  });
}

function notYet(what: string) {
  notice('notYet', { message: `${what} — not built yet`, icon: 'construction', timeout: 1500 });
}
</script>
