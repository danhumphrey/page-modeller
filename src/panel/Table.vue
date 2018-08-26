<template>
    <v-data-table
            :items="model"
            hide-actions
            hide-headers
            class="elevation-0 model-table"
    >
        <template slot="items" slot-scope="props">
            <td>{{ props.item.name }}</td>
            <td class="text-xs-right">Actions</td>
        </template>
        <template slot="no-data">
            <td>Scan the page to build a model</td>
        </template>
    </v-data-table>
</template>

<script>
export default {
  name: 'Table',
  props: [''],
};
</script>

<style scoped>
.model-table {
  margin-top: 2em;
}
</style>
