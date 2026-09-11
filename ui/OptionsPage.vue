<template>
  <main class="options">
    <h1 class="title">Page Modeller Options</h1>

    <div v-for="option in options" :key="option.key" class="option">
      <q-toggle
        :model-value="settings[option.key] as boolean"
        :data-testid="`option-${option.key}`"
        @update:model-value="set(option.key, $event)"
      />
      <div class="option-text">
        <div class="option-label">{{ option.label }}</div>
        <div class="option-hint">{{ option.hint }}</div>
      </div>
    </div>

    <div class="option">
      <q-input
        v-model="testIdAttribute"
        dense
        outlined
        class="attr-input"
        placeholder="data-testid"
        data-testid="option-testIdAttribute"
        @blur="commitTestIdAttribute"
        @keydown.enter="commitTestIdAttribute"
      />
      <div class="option-text">
        <div class="option-label">Test ID attribute</div>
        <div class="option-hint">
          Where a test id lives. Playwright, Cypress and Testing Library each let a project choose;
          <code>data-qa</code> and <code>data-test</code> are common. Must match your test runner’s own setting, or the
          generated <code>getByTestId</code> will not resolve.
        </div>
      </div>
    </div>

    <div class="option">
      <q-select
        v-model="theme"
        dense
        outlined
        emit-value
        map-options
        class="theme-select"
        :options="themeOptions"
        data-testid="option-theme"
      />
      <div class="option-text">
        <div class="option-label">Theme</div>
        <div class="option-hint">System follows the browser, and DevTools when the panel is docked there.</div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { applyTheme } from './theme';
import { defaultSettings, loadSettings, saveSettings, watchSettings, type Settings, type ThemePreference } from '@/src/settings';

type BooleanKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

// Hints say what the setting does, not what it is called — the label already
// does that.
const options: Array<{ key: BooleanKey; label: string; hint: string }> = [
  { key: 'showTooltips', label: 'Show tooltips', hint: 'Tooltips on the toolbar and row buttons.' },
  {
    key: 'appendTypeToName',
    label: 'Append the element type to names',
    hint: '“FeelTheMagic” becomes “FeelTheMagicLink”.',
  },
  {
    key: 'modelHiddenElements',
    label: 'Model hidden elements',
    hint: 'Scan includes elements hidden from the accessibility tree — a validation message, or a modal not yet opened.',
  },
  {
    key: 'clickTableRowsToViewMatchedElements',
    label: 'Click a row to view matched elements',
    hint: 'Otherwise only the eye does it. Double-click always opens the editor.',
  },
];

const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const $q = useQuasar();
const settings = ref<Settings>({ ...defaultSettings });
let unwatch: (() => void) | undefined;

// Kept local while typing and written on blur or Enter: saving per keystroke
// would store `data-t` on the way to `data-testid`, and every frame re-reads
// the setting when it changes.
const testIdAttribute = ref(settings.value.testIdAttribute);
watch(
  () => settings.value.testIdAttribute,
  (v) => {
    testIdAttribute.value = v;
  }
);

function commitTestIdAttribute() {
  const next = testIdAttribute.value.trim() || defaultSettings.testIdAttribute;
  testIdAttribute.value = next;
  if (next !== settings.value.testIdAttribute) set('testIdAttribute', next);
}

const theme = computed({
  get: () => settings.value.theme,
  set: (value: ThemePreference) => set('theme', value),
});

onMounted(async () => {
  settings.value = await loadSettings();
  applyTheme($q, settings.value.theme);
  // Another surface may change these; the page should not go stale.
  unwatch = watchSettings((next) => {
    settings.value = next;
    applyTheme($q, next.theme);
  });
});

onBeforeUnmount(() => unwatch?.());

async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings.value = { ...settings.value, [key]: value };
  // This page follows its own setting, so the choice is visible here rather
  // than only after opening the panel.
  applyTheme($q, settings.value.theme);
  await saveSettings(settings.value);
}
</script>

<style scoped>
.options {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 24px;
  color: var(--pm-text);
}

.title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 24px;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--pm-rule);
}

.option-text {
  min-width: 0;
}

.option-label {
  font-size: 14px;
}

.option-hint {
  font-size: 12px;
  color: var(--pm-text-muted);
  margin-top: 2px;
}

.attr-input {
  width: 180px;
  flex: none;
}

.theme-select {
  width: 140px;
  flex: 0 0 auto;
}
</style>
