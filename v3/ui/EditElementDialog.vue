<template>
  <q-dialog v-model="open" @hide="$emit('close')">
    <q-card class="edit-card">
      <q-toolbar class="dialog-header">
        <q-toolbar-title class="text-subtitle1">Edit Element</q-toolbar-title>
      </q-toolbar>

      <q-card-section class="q-gutter-md">
        <q-input
          v-model="name"
          dense
          autofocus
          label="Name"
          :error="nameError !== ''"
          :error-message="nameError"
          data-testid="edit-name"
          @keydown.enter="save"
        />

        <!-- Read-only: the frame chain is where the element IS, not part of how
             it is found within that frame. Editing it would be editing the
             page. Shown because two elements can otherwise look identical
             (SPEC §16). -->
        <div v-if="framePath.length" class="frame-row" data-testid="edit-frame">
          <span class="frame-label">Frame</span>
          <span class="frame-chain">
            <template v-for="(step, i) in framePath" :key="i">
              <span v-if="i > 0" class="frame-sep">›</span>
              <code>{{ step }}</code>
            </template>
          </span>
        </div>
        <div v-if="frameOpaque" class="frame-warn" data-testid="edit-frame-opaque">
          A frame above this one is cross-origin, so the chain starts inside it.
        </div>

        <div class="locator-row">
          <q-select
            v-model="kind"
            dense
            emit-value
            map-options
            options-dense
            class="type-select"
            label="Type"
            :options="typeOptions"
            data-testid="edit-type"
          />

          <!-- One input per field the type needs: `role` takes a role AND a
               name, so a single value box cannot express it (SPEC §12). -->
          <q-input
            v-for="field in fields"
            :key="field.key"
            v-model="values[field.key]"
            dense
            class="field"
            :label="field.label"
            :data-testid="`edit-${field.key}`"
            @keydown.enter="save"
          />

          <q-btn
            flat
            dense
            round
            icon="visibility"
            :disable="!locatorComplete"
            data-testid="edit-highlight"
            @click="$emit('highlight', candidate)"
          >
            <q-tooltip>View Matched Elements</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat no-caps label="Cancel" data-testid="edit-cancel" />
        <q-btn
          flat
          no-caps
          label="Save"
          :disable="nameError !== '' || !locatorComplete"
          data-testid="edit-save"
          @click="save"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { frameworkById } from '@/src/frameworks';
import { activeCandidate, type ModelElement } from '@/src/model';
import { buildCandidate, fieldsFor, isComplete, valuesOf, type LocatorKind } from '@/src/locators/fields';
import type { LocatorCandidate } from '@/src/engine/types';
import { frameSelector, isOpaque } from '@/src/locators/frames';

const props = defineProps<{
  element: ModelElement;
  frameworkId: string;
  /** Every other name in the model, for the uniqueness check. */
  takenNames: string[];
}>();

const emit = defineEmits<{
  close: [];
  highlight: [candidate: LocatorCandidate];
  save: [payload: { name: string; selectedIndex: number; override?: LocatorCandidate }];
}>();

const open = ref(true);
const name = ref(props.element.name);

const current = activeCandidate(props.element);
const kind = ref<LocatorKind>(current.kind);
const values = ref<Record<string, string>>(valuesOf(current));

/** The full framework list, not just what was generated (SPEC §7). */
// The chain as selector strings; `:root` stands for a cross-origin break, so
// it is reported as prose rather than shown as a selector nobody typed.
const framePath = computed(() =>
  (props.element.framePath ?? []).filter((s) => !s.opaque).map((s) => frameSelector(s))
);
const frameOpaque = computed(() => isOpaque(props.element.framePath));

const typeOptions = computed(() => frameworkById(props.frameworkId).locatorTypes.map((t) => ({ label: t, value: t })));

const fields = computed(() => fieldsFor(kind.value));
const candidate = computed(() => buildCandidate(kind.value, values.value));

/**
 * An incomplete locator is not testable or saveable. Blank does not mean "match
 * anything" — an empty `label` matches every control with no accessible name,
 * which is how it reported 8 matches for a field the user had not filled in.
 */
const locatorComplete = computed(() => isComplete(kind.value, values.value));

/**
 * Switching type reuses the generated candidate of that kind when there is one,
 * and blanks the fields when there is not — the generated set is a convenience,
 * never a constraint (SPEC §7).
 */
watch(kind, (next) => {
  const generated = props.element.candidates.find((c) => c.candidate.kind === next);
  values.value = generated ? valuesOf(generated.candidate) : Object.fromEntries(fieldsFor(next).map((f) => [f.key, '']));
});

const nameError = computed(() => {
  const value = name.value.trim();
  if (!value) return 'Name is required.';
  if (/\s/.test(value)) return 'Name cannot contain spaces.';
  if (props.takenNames.includes(value)) return 'Name must be unique.';
  return '';
});

function save() {
  if (nameError.value || !locatorComplete.value) return;
  // An edited locator that matches a generated one is stored as that selection
  // rather than an override, so it keeps tracking the engine's own verification.
  const index = props.element.candidates.findIndex(
    (c) => JSON.stringify(c.candidate) === JSON.stringify(candidate.value)
  );
  emit('save', {
    name: name.value.trim(),
    selectedIndex: index >= 0 ? index : props.element.selectedIndex,
    override: index >= 0 ? undefined : candidate.value,
  });
  open.value = false;
}
</script>

<style scoped>
.frame-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
}

.frame-label {
  color: var(--pm-muted);
}

.frame-chain code {
  font: 12px/1.5 ui-monospace, SFMono-Regular, monospace;
}

.frame-sep {
  margin: 0 4px;
  color: var(--pm-muted);
}

.frame-warn {
  font-size: 12px;
  color: var(--pm-warn, #d29922);
}

.edit-card {
  width: 100%;
  max-width: 720px;
  background: var(--pm-page-bg);
  color: var(--pm-text);
}

/* Neutral, like the main toolbar: the panel sits inside DevTools or a browser
   sidebar and should read as part of that chrome, not as a branded surface. */
.dialog-header {
  background: var(--pm-toolbar-bg);
  color: var(--pm-toolbar-fg);
  border-bottom: 1px solid var(--pm-rule);
  min-height: 44px;
}

/* Own flex rather than Quasar's `row` utility: a bare `row` class collides with
   it everywhere else in this app, and one absolute rule is easier to keep than
   a rule with exceptions. */
.locator-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: nowrap;
  gap: 8px;
}

.type-select {
  flex: 0 0 34%;
}

.field {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
