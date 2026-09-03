<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary">
      <q-toolbar>
        <q-toolbar-title class="text-subtitle1">Page Modeller</q-toolbar-title>
        <q-btn
          :color="picking ? 'negative' : 'white'"
          :text-color="picking ? 'white' : 'primary'"
          :icon="picking ? 'stop' : 'ads_click'"
          :label="picking ? 'Stop' : 'Pick element'"
          dense
          no-caps
          data-testid="pick-toggle"
          @click="togglePick"
        />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page padding>
        <q-input v-model="className" dense outlined label="Class name" class="q-mb-md" data-testid="class-name" />

        <div v-if="elements.length === 0" class="text-grey text-center q-pa-lg" data-testid="empty-state">
          Click <strong>Pick element</strong>, then click elements on the page to model them.
        </div>

        <q-list v-else bordered separator class="rounded-borders q-mb-md">
          <q-item v-for="el in elements" :key="el.id">
            <q-item-section>
              <q-input v-model="el.name" dense borderless class="text-weight-medium" />
              <div class="row items-center q-gutter-xs q-mt-xs">
                <q-chip v-if="el.role" dense size="sm" color="blue-1" text-color="primary">{{ el.role }}</q-chip>
                <q-select
                  v-model="el.selectedIndex"
                  :options="candidateOptions(el)"
                  emit-value
                  map-options
                  dense
                  options-dense
                  borderless
                  class="col"
                />
              </div>
            </q-item-section>
            <q-item-section side top>
              <q-btn flat round dense size="sm" icon="close" @click="remove(el.id)" />
            </q-item-section>
          </q-item>
        </q-list>

        <q-card flat bordered>
          <q-card-section class="row items-center q-py-sm">
            <div class="text-overline">{{ generator.label }}</div>
            <q-space />
            <q-btn
              flat
              dense
              icon="content_copy"
              label="Copy"
              no-caps
              :disable="elements.length === 0"
              data-testid="copy-code"
              @click="copyCode"
            />
          </q-card-section>
          <q-separator />
          <q-card-section class="q-pa-none">
            <pre class="code" data-testid="code-output">{{ generatedCode }}</pre>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { browser } from 'wxt/browser';
import { deriveName } from '@/src/engine/naming';
import type { ElementModel } from '@/src/engine/types';
import { isMessage, type ContentToPanel } from '@/src/messaging';
import { generators, defaultGenerator, type PomModel } from '@/src/generators';
import { candidateExpr } from '@/src/generators/playwright-ts';

const $q = useQuasar();
const picking = ref(false);
const className = ref('GeneratedPage');
const elements = ref<ElementModel[]>([]);
const generator = computed(() => generators[defaultGenerator]);

const usedNames = new Set<string>();

function candidateOptions(el: ElementModel) {
  return el.candidates.map((c, i) => ({ label: candidateExpr(c.candidate), value: i }));
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function togglePick() {
  const tabId = await activeTabId();
  if (tabId == null) return;
  if (picking.value) {
    await browser.tabs.sendMessage(tabId, { type: 'STOP_PICKING' });
    picking.value = false;
  } else {
    await browser.tabs.sendMessage(tabId, { type: 'START_PICKING' });
    picking.value = true;
  }
}

function remove(id: string) {
  elements.value = elements.value.filter((e) => e.id !== id);
}

let idSeq = 0;

browser.runtime.onMessage.addListener((msg: unknown) => {
  if (!isMessage(msg)) return;
  const m = msg as ContentToPanel;
  if (m.type === 'ELEMENT_PICKED') {
    const name = deriveName(m.result, usedNames);
    elements.value.push({
      ...m.result,
      id: `el-${idSeq++}`,
      name,
      selectedIndex: m.result.preferredIndex >= 0 ? m.result.preferredIndex : 0,
      framePath: [],
    });
  } else if (m.type === 'PICKING_STOPPED') {
    picking.value = false;
  }
});

const generatedCode = computed(() => {
  const model: PomModel = {
    className: className.value,
    elements: elements.value.map((el) => ({
      name: el.name,
      candidate: el.candidates[el.selectedIndex]?.candidate ?? el.candidates[0].candidate,
      role: el.role,
    })),
  };
  return generator.value.generate(model);
});

async function copyCode() {
  await navigator.clipboard.writeText(generatedCode.value);
  $q.notify({ message: 'Copied to clipboard', icon: 'content_copy', timeout: 1200, position: 'bottom' });
}
</script>

<style scoped>
.code {
  margin: 0;
  padding: 12px;
  font: 12px/1.5 ui-monospace, SFMono-Regular, monospace;
  white-space: pre;
  overflow-x: auto;
}
</style>
