<template>
    <div class="model-table">
        <v-toolbar dense flat>

        </v-toolbar>

        <v-data-table
                :items="model == null ? [] : model.entities"
                hide-actions
                hide-headers
                class="elevation-0"
        >
            <template slot="items" slot-scope="props">
                <td>
                    <v-edit-dialog
                            :return-value.sync="props.item.name"


                    > {{ props.item.name }}
                        <v-text-field
                                slot="input"
                                v-model="props.item.name"
                                :rules="[uniqueNameRule]"
                                label="Edit"
                                single-line
                        ></v-text-field>
                    </v-edit-dialog>
                </td>
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
  props: ['model'],
  data() {
    return {
      uniqueNameRule: v => {
        let usedCount = 0;
        for (let entity of this.model.entities) {
          if (entity.name === v) {
            usedCount++;
          }
        }
        return usedCount > 1 ? 'Name must be unique!' : true;
      },
    };
  },
  methods: {},
};
</script>

<style scoped lang="scss">
@import '../styles/settings';
@import '../styles/material';
@import '../styles/buttons';

.model-table {
  margin: 6em 2em 0 2em;
}
</style>
