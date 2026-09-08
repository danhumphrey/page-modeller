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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
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

.theme-select {
  width: 140px;
  flex: 0 0 auto;
}
</style>
