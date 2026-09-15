<template>
  <div class="model-table">
    <table>
      <thead>
        <tr>
          <th class="col-name">Name</th>
          <th class="col-locator">Locator</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="elements.length === 0">
          <td colspan="3" class="empty" data-testid="empty-state">Scan the page or start adding elements to build the model</td>
        </tr>
        <tr
          v-for="el in elements"
          :key="el.id"
          class="pm-row"
          :class="{ clickable: clickToHighlight }"
          @click="clickToHighlight && $emit('highlight', el.id)"
          @dblclick="$emit('edit', el.id)"
        >
          <td class="col-name">{{ el.name }}</td>
          <!-- `type: value` (SPEC §6). Long CSS and XPath must not widen the
               panel, so the cell truncates and carries the full text. -->
          <td class="col-locator"><span :title="el.locator">{{ el.locator }}</span></td>
          <!-- Icon-only, so aria-label is the only name these have — and it
               carries the row's element, because "Delete" repeated down a
               table says nothing about WHICH one. The tooltips are gated on a
               setting and are not a name in any case. -->
          <td class="col-actions">
            <q-btn flat dense round size="sm" icon="visibility" :aria-label="`View Matched Elements ${el.name}`" @click.stop="$emit('highlight', el.id)">
              <q-tooltip v-if="showTooltips">View Matched Elements</q-tooltip>
            </q-btn>
            <q-btn flat dense round size="sm" icon="edit" :aria-label="`Edit ${el.name}`" @click.stop="$emit('edit', el.id)">
              <q-tooltip v-if="showTooltips">Edit</q-tooltip>
            </q-btn>
            <q-btn flat dense round size="sm" icon="delete" :aria-label="`Delete ${el.name}`" @click.stop="$emit('remove', el.id)">
              <q-tooltip v-if="showTooltips">Delete</q-tooltip>
            </q-btn>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
/** One row of the model table. The session model itself lands with capture. */
export interface ModelRow {
  id: string;
  name: string;
  /** Rendered `type: value`, or the framework expression for Playwright. */
  locator: string;
}

defineProps<{
  elements: ModelRow[];
  /** Single-click a row runs View Matched Elements — off by default (SPEC §6). */
  clickToHighlight: boolean;
  showTooltips: boolean;
}>();

defineEmits<{
  highlight: [id: string];
  edit: [id: string];
  remove: [id: string];
}>();
</script>

<style scoped>
.model-table {
  overflow-x: auto;
  /* v2.5.1 insets the table from the panel edges rather than running it flush. */
  padding: 8px var(--pm-gutter) 0;
  /* Pairs with the table's min-width: the table stops shrinking, and this is
     what lets the rest be reached. */
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  /* A floor, not a width. Name takes 34% and Actions a fixed 104px, so in a
     narrow Firefox sidebar the locator column was down to about a dozen
     characters — every row ellipsised to `css: div.` and the column carrying
     no information at all. Below this the container scrolls sideways instead
     of the column being crushed; at any ordinary panel width nothing changes
     and no scrollbar appears. */
  min-width: 380px;
}

th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--pm-text-muted);
  padding: 10px 8px;
  border-bottom: 1px solid var(--pm-rule);
  white-space: nowrap;
}

td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--pm-rule);
  font-size: 13px;
  color: var(--pm-text);
}

/* table-layout: fixed needs real widths — `width: 1%` collapses the Actions
   column to nothing and its header disappears at side-panel width. */
.col-name {
  width: 34%;
}

.col-actions {
  width: 104px;
  white-space: nowrap;
  text-align: right;
}

.col-locator span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
}

/* Namespaced: a bare `.row` is Quasar's flex grid utility (display: flex;
   flex-wrap: wrap), which stacks the cells of every row. */
.pm-row {
  cursor: default;
  user-select: none;
}

.pm-row.clickable {
  cursor: pointer;
}

.pm-row:hover {
  background: var(--pm-row-hover);
}

.empty {
  padding: 24px 8px;
  color: var(--pm-text-muted);
  text-align: center;
}
</style>
