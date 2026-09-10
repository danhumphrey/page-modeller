<template>
  <q-toolbar class="app-toolbar">
    <!-- Enablement rules are SPEC §3. Scan and the framework selector lock once
         a model exists; the framework is chosen up front because locator types
         are framework-specific. -->
    <q-btn flat dense round icon="manage_search" :disable="hasModel || isAdding" data-testid="btn-scan" @click="$emit('scan')">
      <q-tooltip v-if="showTooltips">Scan Page</q-tooltip>
    </q-btn>

    <q-btn flat dense round icon="delete_sweep" :disable="!hasModel || isPicking" data-testid="btn-delete-model" @click="$emit('deleteModel')">
      <q-tooltip v-if="showTooltips">Delete Model</q-tooltip>
    </q-btn>

    <q-btn flat dense no-caps :disable="hasModel || isPicking" class="framework" data-testid="framework-selector">
      <span class="ellipsis">{{ framework.label }}</span>
      <q-icon name="arrow_drop_down" />
      <q-tooltip v-if="showTooltips">Select Target Framework</q-tooltip>
      <q-menu auto-close>
        <q-list dense style="min-width: 200px">
          <q-item
            v-for="f in frameworks"
            :key="f.id"
            v-close-popup
            clickable
            :active="f.id === framework.id"
            @click="$emit('update:frameworkId', f.id)"
          >
            <q-item-section>{{ f.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <q-space />

    <q-btn flat dense round icon="playlist_add" :disable="isScanning" data-testid="btn-add" @click="$emit('add')">
      <q-tooltip v-if="showTooltips">Add Element</q-tooltip>
    </q-btn>

    <!-- Never disabled: the one control whose whole job is to explain the
         others is no use only when everything is already clear. -->
    <q-btn flat dense round icon="help_outline" data-testid="btn-help" @click="$emit('help')">
      <q-tooltip v-if="showTooltips">How picking works</q-tooltip>
    </q-btn>

    <q-btn flat dense round icon="code" :disable="!hasModel || isPicking" data-testid="btn-generate" @click="$emit('generate')">
      <q-tooltip v-if="showTooltips">Generate Code</q-tooltip>
    </q-btn>
  </q-toolbar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { frameworks, frameworkById } from '@/src/frameworks';

const props = defineProps<{
  frameworkId: string;
  hasModel: boolean;
  isScanning: boolean;
  isAdding: boolean;
  showTooltips: boolean;
}>();

defineEmits<{
  scan: [];
  add: [];
  deleteModel: [];
  generate: [];
  help: [];
  'update:frameworkId': [id: string];
}>();

const framework = computed(() => frameworkById(props.frameworkId));
const isPicking = computed(() => props.isScanning || props.isAdding);
</script>

<style scoped>
/* The side panel can be ~350px wide, so the framework name has to be able to
   give up space rather than push the right-hand buttons off the edge. */
.app-toolbar {
  background: var(--pm-toolbar-bg);
  color: var(--pm-toolbar-fg);
  border-bottom: 1px solid var(--pm-rule);
  min-height: 44px;
  padding: 0 4px;
}

.framework {
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
}

/* Enablement is the toolbar's main signal (SPEC §3), so disabled has to read
   clearly against the neutral ground. */
.app-toolbar :deep(.disabled) {
  opacity: 0.35 !important;
}
</style>
