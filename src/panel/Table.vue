<template>
    <div class="model-table">
        <v-toolbar dense flat>
            <!--
            <v-tooltip bottom :disabled="hasModel" open-delay="600">
                <v-btn slot="activator" ref="btn-scan" id="btn-scan" icon :disabled="hasModel" v-on:click="inspect" v-bind:class="{active: isInspecting}">
                    <v-icon>find_in_page</v-icon>
                </v-btn>
                <span v-if="!isInspecting">Scan Page</span>
                <span v-if="isInspecting">Stop Scanning</span>

            </v-tooltip>
            -->
            <v-tooltip bottom open-delay="600">
                <v-btn slot="activator" icon>
                    <v-icon>playlist_add</v-icon>
                </v-btn>
                <span>Add Single Element</span>
            </v-tooltip>
        </v-toolbar>
        <v-data-table
                :items="model == null ? [] : model.entities"
                hide-actions
                hide-headers
                class="elevation-0"
        >
            <template slot="items" slot-scope="props">
                <td>{{ props.item.name }}</td>
                <td class="text-xs-right">Actions</td>
            </template>
            <template slot="no-data">
                <td>Scan the page or add a single element to build the model</td>
            </template>
        </v-data-table>
    </div>

</template>

<script>
export default {
  name: 'Table',
  props: ['model', 'isScanning', 'isAdding'],
};
</script>

<style scoped lang="scss">
@import '../styles/settings';
@import '../styles/material';
@import '../styles/buttons';

.model-table {
  margin: 2em;
}
</style>
