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
import { isMessage, type ContentToPanel, type HighlightResult, type PickMode } from '@/src/messaging';
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
});

onBeforeUnmount(() => window.removeEventListener('keydown', onPanelKey, true));

function onPanelKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !isPicking()) return;
  e.preventDefault();
  void stopPicking();
}

host.onTabChanged((next) => {
  if (isPicking() && tabId.value != null) void send(tabId.value, { type: 'STOP_PICKING' });
  isScanning.value = isAdding.value = false;
  tabId.value = next;
  syncFromStore();
});

const isPicking = () => isScanning.value || isAdding.value;

async function stopPicking() {
  if (tabId.value != null) await send(tabId.value, { type: 'STOP_PICKING' });
  isAdding.value = isScanning.value = false;
}

async function send(target: number, msg: { type: 'START_PICKING'; mode: PickMode } | { type: 'STOP_PICKING' }): Promise<boolean> {
  try {
    await browser.tabs.sendMessage(target, msg);
    return true;
  } catch {
    // No content script: a browser-internal page, the web store, or a tab that
    // was already open when the extension loaded.
    $q.notify({
      message: 'Page Modeller can’t reach this page. Reload the tab, or try a normal http(s) page.',
      icon: 'block',
      color: 'negative',
      timeout: 3000,
      position: 'bottom',
    });
    return false;
  }
}

async function toggleAdd() {
  if (isAdding.value) return stopPicking();
  const target = tabId.value ?? (await host.getTabId());
  tabId.value = target;
  if (target == null) return;
  if (await send(target, { type: 'START_PICKING', mode: 'add' })) isAdding.value = true;
}

let idSeq = 0;

browser.runtime.onMessage.addListener((msg: unknown, sender: { tab?: { id?: number } }) => {
  if (!isMessage(msg)) return;
  // Only this panel's tab. Without it, a DevTools panel would absorb every
  // other tab's picks.
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
  }
});

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
// Quasar groups identical notifications and badges a count, so repeated eye
// clicks piled up a "4". Each check should replace the last one's answer.
let dismissMatchCount: (() => void) | undefined;

function clearHighlight() {
  if (tabId.value == null) return;
  void browser.tabs.sendMessage(tabId.value, { type: 'CLEAR_HIGHLIGHT' }, { frameId: 0 }).catch(() => {});
}

async function highlight(id: string) {
  const el = elements.value.find((e) => e.id === id);
  if (!el || tabId.value == null) return;

  let count = 0;
  try {
    const res = (await browser.tabs.sendMessage(tabId.value, { type: 'HIGHLIGHT', candidate: activeCandidate(el) }, { frameId: 0 })) as
      | HighlightResult
      | undefined;
    count = res?.count ?? 0;
  } catch {
    $q.notify({
      message: 'Page Modeller can’t reach this page. Reload the tab, or try a normal http(s) page.',
      icon: 'block',
      color: 'negative',
      timeout: 3000,
      position: 'bottom',
    });
    return;
  }

  const tone =
    count === 1
      ? { icon: 'check_circle', color: 'positive' }
      : count === 0
        ? { icon: 'error', color: 'negative' }
        : { icon: 'warning', color: 'warning' };

  dismissMatchCount?.();
  dismissMatchCount = $q.notify({
    ...tone,
    message: `${count} element${count === 1 ? '' : 's'} match${count === 1 ? 'es' : ''} that locator`,
    group: false,
    timeout: 3000,
    position: 'bottom',
    // Close takes the highlight with it, so the page is never left marked up
    // with no explanation. Only on the explicit action: onDismiss would also
    // fire when this notification is *replaced* by the next eye click, wiping
    // the highlight that click had just applied. Natural expiry needs no
    // handler — both timers are 3s.
    actions: [{ label: 'Close', color: 'white', handler: clearHighlight }],
  });
}

function notYet(what: string) {
  $q.notify({ message: `${what} — not built yet`, icon: 'construction', timeout: 1500, position: 'bottom' });
}
</script>
