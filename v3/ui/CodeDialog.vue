<template>
  <q-dialog v-model="open" @hide="$emit('close')">
    <q-card class="code-card">
      <q-toolbar class="dialog-header">
        <q-toolbar-title class="text-subtitle1">{{ frameworkLabel }}</q-toolbar-title>
        <!-- Shapes are per-framework, so this is hidden when there is only one. -->
        <q-btn-toggle
          v-if="shapes.length > 1"
          v-model="shapeId"
          :options="shapeOptions"
          flat
          dense
          no-caps
          toggle-color="primary"
          class="shape-toggle q-mr-sm"
          data-testid="code-shape"
        />
        <q-btn flat dense no-caps icon="content_copy" label="Copy" data-testid="code-copy" @click="copy" />
      </q-toolbar>

      <q-card-section class="q-pa-none">
        <!-- Read-only, as in v2.5.1: the model is edited in the table, not here. -->
        <pre class="code" data-testid="code-output">{{ code }}</pre>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat no-caps label="OK" data-testid="code-ok" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { frameworkById } from '@/src/frameworks';
import { generateCode, shapesFor } from '@/src/generators';
import type { TabModel } from '@/src/model';

const props = defineProps<{ model: TabModel }>();
defineEmits<{ close: [] }>();

const $q = useQuasar();
const open = ref(true);

const frameworkLabel = computed(() => frameworkById(props.model.frameworkId).label);

// Dialog-local, not stored on the model: which shape you want to read is a
// property of this glance at the code, not of the elements you have captured.
const shapes = computed(() => shapesFor(props.model.frameworkId));
const shapeOptions = computed(() => shapes.value.map((s) => ({ label: s.label, value: s.id })));
const shapeId = ref(shapes.value[0]?.id);

const code = computed(() => generateCode(props.model, shapeId.value));

async function copy() {
  try {
    await navigator.clipboard.writeText(code.value);
    $q.notify({ message: 'Copied to clipboard', icon: 'content_copy', timeout: 1200, position: 'bottom' });
  } catch {
    // A panel without clipboard permission, or a denied prompt. Say so rather
    // than appearing to have copied.
    $q.notify({ message: 'Could not copy — select the code and copy it', icon: 'block', color: 'negative', position: 'bottom' });
  }
}
</script>

<style scoped>
.code-card {
  width: 100%;
  max-width: 900px;
  background: var(--pm-page-bg);
  color: var(--pm-text);
}

.dialog-header {
  background: var(--pm-toolbar-bg);
  color: var(--pm-toolbar-fg);
  border-bottom: 1px solid var(--pm-rule);
  min-height: 44px;
}

.shape-toggle {
  border: 1px solid var(--pm-rule);
  border-radius: 4px;
}

.code {
  margin: 0;
  padding: 16px;
  /* The panel is narrow; long locators scroll rather than widening the dialog. */
  max-height: 60vh;
  overflow: auto;
  font: 12px/1.6 ui-monospace, SFMono-Regular, monospace;
  white-space: pre;
  color: var(--pm-text);
  user-select: text;
}
</style>
