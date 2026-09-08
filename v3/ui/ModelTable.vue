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
          @click="$emit('highlight', el.id)"
          @dblclick="$emit('edit', el.id)"
        >
          <td class="col-name">{{ el.name }}</td>
          <!-- `type: value` (SPEC §6). Long CSS and XPath must not widen the
               panel, so the cell truncates and carries the full text. -->
          <td class="col-locator"><span :title="el.locator">{{ el.locator }}</span></td>
          <td class="col-actions">
            <q-btn flat dense round size="sm" icon="visibility" @click.stop="$emit('highlight', el.id)">
              <q-tooltip>View Matched Elements</q-tooltip>
            </q-btn>
            <q-btn flat dense round size="sm" icon="edit" @click.stop="$emit('edit', el.id)">
              <q-tooltip>Edit</q-tooltip>
            </q-btn>
            <q-btn flat dense round size="sm" icon="delete" @click.stop="$emit('remove', el.id)">
              <q-tooltip>Delete</q-tooltip>
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

defineProps<{ elements: ModelRow[] }>();

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
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
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

.pm-row:hover {
  background: var(--pm-row-hover);
}

.empty {
  padding: 24px 8px;
  color: var(--pm-text-muted);
  text-align: center;
}
</style>
