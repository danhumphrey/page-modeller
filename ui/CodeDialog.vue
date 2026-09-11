<template>
  <q-dialog v-model="open" @hide="emit('close')">
    <q-card class="code-card">
      <q-toolbar class="dialog-header">
        <q-toolbar-title class="text-subtitle1">{{ frameworkLabel }}</q-toolbar-title>
        <q-btn flat dense no-caps icon="content_copy" label="Copy" data-testid="code-copy" @click="copy" />
      </q-toolbar>

      <!-- Its own row: in the sidebar there is no width to share with the
           title, and three shapes plus Copy pushed the title to "Seleniu…".
           Shapes are per-framework, so this is absent when there is only one. -->
      <div v-if="shapes.length > 1" class="shape-row">
        <q-btn-toggle
          v-model="shapeId"
          :options="shapeOptions"
          spread
          unelevated
          dense
          no-caps
          toggle-color="primary"
          class="shape-toggle"
          data-testid="code-shape"
        />
      </div>

      <q-card-section class="code-body q-pa-none">
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
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { frameworkById } from '@/src/frameworks';
import { generateCode, shapesFor } from '@/src/generators';
import type { TabModel } from '@/src/model';

const props = defineProps<{ model: TabModel; shape?: string }>();
const emit = defineEmits<{ close: []; 'update:shape': [id: string] }>();

const $q = useQuasar();
const open = ref(true);

const frameworkLabel = computed(() => frameworkById(props.model.frameworkId).label);

// Not stored on the model: which shape you want to read is a property of this
// glance at the code, not of the elements you have captured. Handed up to the
// panel so it survives closing the dialog — someone who works in locators-only
// should not re-pick it every time — but not to settings: it lasts as long as
// the panel does, and no longer.
const shapes = computed(() => shapesFor(props.model.frameworkId));
const shapeOptions = computed(() => shapes.value.map((s) => ({ label: s.label, value: s.id })));
const shapeId = ref(
  // A remembered shape the current framework does not offer falls back to its
  // first: `methods` means nothing to Playwright.
  shapes.value.some((s) => s.id === props.shape) ? (props.shape as string) : shapes.value[0]?.id
);
watch(shapeId, (id) => id && emit('update:shape', id));

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
/* Doubled class to out-specify Quasar's `.q-dialog__inner--minimized > div`,
   which caps a dialog at 560px wide and 100dvh - 48px tall. */
.code-card.code-card {
  /* Fixed to the viewport, not to the content: switching shape changes the
     line count wildly, and a card that resizes under the pointer is jarring.
     The dialog's own padding supplies the surrounding margin. */
  width: 90vw;
  max-width: 90vw;
  height: 90vh;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--pm-page-bg);
  color: var(--pm-text);
}

/* min-height: 0 or the flex item refuses to shrink below its content and the
   code scrolls the card instead of itself. */
.code-body {
  flex: 1;
  min-height: 0;
}

.dialog-header {
  background: var(--pm-toolbar-bg);
  color: var(--pm-toolbar-fg);
  border-bottom: 1px solid var(--pm-rule);
  min-height: 44px;
}

.shape-row {
  padding: 8px 12px;
  border-bottom: 1px solid var(--pm-rule);
}

/* `spread` divides the control evenly, so labels stay readable however narrow
   the panel gets. Capped, because at DevTools width a full-bleed segmented
   control reads as a banner rather than a choice — it takes the width it needs
   and no more. */
.shape-toggle {
  width: 100%;
  max-width: 460px;
  border: 1px solid var(--pm-rule);
  border-radius: 4px;
}

.code {
  margin: 0;
  padding: 16px;
  height: 100%;
  /* The panel is narrow; long locators scroll rather than widening the dialog. */
  overflow: auto;
  font: 12px/1.6 ui-monospace, SFMono-Regular, monospace;
  white-space: pre;
  color: var(--pm-text);
  user-select: text;
}
</style>
