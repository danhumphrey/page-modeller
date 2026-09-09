<template>
  <q-dialog v-model="open" @hide="onHide">
    <q-card class="help-card">
      <q-toolbar class="dialog-header">
        <q-toolbar-title class="text-subtitle1">{{ title }}</q-toolbar-title>
      </q-toolbar>

      <q-card-section v-for="section in sections" :key="section.title" class="section">
        <div v-if="sections.length > 1" class="section-title">{{ section.title }}</div>
        <p class="lead">{{ section.lead }}</p>
        <dl class="keys">
          <template v-for="row in section.keys" :key="row.key">
            <dt><kbd>{{ row.key }}</kbd></dt>
            <dd>{{ row.what }}</dd>
          </template>
        </dl>
      </q-card-section>

      <q-card-actions align="between" class="actions">
        <!-- Only offered when this opened by itself. Asked to see it, you are
             not asking to be rid of it. -->
        <q-checkbox
          v-if="dismissable"
          v-model="dontShowAgain"
          dense
          size="sm"
          label="Don’t show this again"
          data-testid="help-dont-show"
        />
        <span v-else />
        <q-btn v-close-popup flat no-caps label="Got it" data-testid="help-ok" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  /** `all` when opened from the toolbar; a single mode on first use. */
  mode: 'add' | 'scan' | 'all';
  /** The multi-add modifier, named for this platform. */
  multiKey: string;
}>();
const emit = defineEmits<{ close: []; dismiss: [modes: ('add' | 'scan')[]] }>();

const open = ref(true);
const dontShowAgain = ref(false);
const dismissable = computed(() => props.mode !== 'all');

const ADD = (multiKey: string) => ({
  title: 'Adding elements',
  lead: 'Click any element on the page to add it to the model.',
  keys: [
    { key: '↑↓', what: 'walk the DOM while hovering, to select the exact element' },
    { key: `${multiKey}+Click`, what: 'keep adding multiple elements' },
    { key: 'Esc', what: 'stop' },
  ],
});

const SCAN = {
  title: 'Scanning a page',
  lead: 'Click a container and everything interactive inside it is modelled at once — a form, a panel, or the page itself.',
  keys: [
    { key: '↑↓', what: 'walk the DOM to widen or narrow what you are about to scan' },
    { key: 'Esc', what: 'stop' },
  ],
};

const sections = computed(() => {
  if (props.mode === 'add') return [ADD(props.multiKey)];
  if (props.mode === 'scan') return [SCAN];
  return [ADD(props.multiKey), SCAN];
});

const title = computed(() => (props.mode === 'all' ? 'Using Page Modeller' : sections.value[0].title));

/**
 * Decided on close rather than on tick, so ticking and then unticking before
 * dismissing means what it looks like it means.
 */
function onHide() {
  if (dontShowAgain.value && props.mode !== 'all') emit('dismiss', [props.mode]);
  emit('close');
}
</script>

<style scoped>
.help-card {
  width: 100%;
  max-width: 440px;
  background: var(--pm-page-bg);
  color: var(--pm-text);
}

.dialog-header {
  background: var(--pm-toolbar-bg);
  color: var(--pm-toolbar-fg);
  border-bottom: 1px solid var(--pm-rule);
  min-height: 44px;
}

.section + .section {
  border-top: 1px solid var(--pm-rule);
}

.section-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.lead {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
}

/* Two columns so the keys line up and the descriptions can run on. */
.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 12px;
  margin: 0;
  font-size: 12px;
}

.keys dt {
  white-space: nowrap;
}

.keys dd {
  margin: 0;
  color: var(--pm-muted);
  line-height: 1.5;
}

kbd {
  font: 11px/1.4 ui-monospace, SFMono-Regular, monospace;
  border: 1px solid var(--pm-rule);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--pm-text);
}

.actions {
  border-top: 1px solid var(--pm-rule);
}
</style>
