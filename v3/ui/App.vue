<template>
  <q-layout view="hHh lpR fFf">
    <q-header>
      <AppToolbar
        v-model:framework-id="frameworkId"
        :has-model="elements.length > 0"
        :is-scanning="isScanning"
        :is-adding="isAdding"
        @scan="notYet('Scan')"
        @add="notYet('Add Element')"
        @delete-model="notYet('Delete Model')"
        @generate="notYet('Generate Code')"
      />
    </q-header>

    <q-page-container>
      <q-page>
        <ModelTable
          :elements="elements"
          @highlight="notYet('View Matched Elements')"
          @edit="notYet('Edit')"
          @remove="notYet('Delete')"
        />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import { useQuasar } from 'quasar';
import AppToolbar from './AppToolbar.vue';
import ModelTable, { type ModelRow } from './ModelTable.vue';
import { defaultFrameworkId } from '@/src/frameworks';
import { hostKey } from '@/host/types';

// Shell only (REWRITE-PLAN §12 step 3): toolbar and table, no capture yet. The
// per-tab session model (SPEC §5) and Add Element (SPEC §4) come next, and
// `elements` becomes that model.
const $q = useQuasar();
const host = inject(hostKey)!;

const frameworkId = ref(defaultFrameworkId);
const elements = ref<ModelRow[]>([]);
const isScanning = ref(false);
const isAdding = ref(false);

function notYet(what: string) {
  $q.notify({ message: `${what} — not built yet`, icon: 'construction', timeout: 1500, position: 'bottom' });
}

// Keeps the host adapter live so tab switching is exercised while hand-testing;
// the model it will swap arrives with SPEC §5.
host.onTabChanged(() => {
  isScanning.value = false;
  isAdding.value = false;
});
</script>
