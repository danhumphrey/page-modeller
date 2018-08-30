<template>
    <div class="model-table">
        <v-data-table
                :items="model == null ? [] : model.entities"
                :headers="headers"
                hide-actions
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
                <td class="text-xs-right px-0">
                    <v-icon
                            small
                            class="mr-2"
                            @click="editItem(props.item)"

                    >
                        edit
                    </v-icon>
                    <v-icon
                            small
                            class="mr-4"
                            @click="deleteItem(props.item)"
                    >
                        delete
                    </v-icon>
                </td>
            </template>
            <template slot="no-data">
                <td colspan="2">Scan the page or add a single element to build the model</td>
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
      headers: [
        {
          text: 'Name',
          align: 'left',
          sortable: false,
        },
        {
          text: 'Actions',
          align: 'right',
          sortable: false,
        },
      ],
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
