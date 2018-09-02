<template>
  <div class="model-table">
    <v-dialog v-model="dialog">
      <v-card>
        <v-card-title class="pa-2">
          <span class="headline">Edit Model Entity</span>
        </v-card-title>
        <v-card-text class="pb-1">
          <v-container grid-list-md pa-0>
            <v-layout wrap>
              <v-flex>
                <v-text-field v-model="editedItem.name" label="Name"></v-text-field>
              </v-flex>
            </v-layout>
            <v-layout wrap>
              <v-flex>
                  <v-select
                    v-model="currentLocator"
                    :items="editedItem.locators"
                    item-text="name"
                    item-value="name"
                    label="Locator"
                    persistent-hint
                    return-object
                    single-line
                  ></v-select>
                <!-- <v-text-field v-model="editedItem.locators.xpath" label="Locator"></v-text-field> -->
              </v-flex>
              <v-flex>
                <v-text-field v-model="currentLocator.locator" :append-icon="'remove_red_eye'">

                  <v-tooltip left open-delay="1000" slot="append">
                    <v-icon
                            slot="activator"
                            small
                            class="mr-2"
                            @click="viewMatches(currentLocator)"
                    >
                      remove_red_eye
                    </v-icon>
                    <span>View Matched Elements</span>
                  </v-tooltip>
                </v-text-field>
              </v-flex>

            </v-layout>
          </v-container>
        </v-card-text>
        <v-card-actions class="py-1">
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" flat @click.native="close">Cancel</v-btn>
          <v-btn color="blue darken-1" flat @click.native="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-data-table
        :items="model == null ? [] : model.entities"
        :headers="headers"
        hide-actions
        class="elevation-0"
    >
      <template slot="items" slot-scope="props">
        <td>{{ props.item.name }}</td>
        <td class="text-xs-right px-0">
          <v-tooltip left open-delay="1000">
            <v-icon
                slot="activator"
                small
                class="mr-2"
                @click="viewMatches(props.item)"
            >
              remove_red_eye
            </v-icon>
            <span>View Matched Elements</span>
          </v-tooltip>
          <v-tooltip left open-delay="1000">
            <v-icon
                slot="activator"
                small
                class="mr-2"
                @click="editItem(props.item)"
            >
              edit
            </v-icon>
            <span>Edit</span>
          </v-tooltip>
          <v-tooltip left open-delay="1000">
            <v-icon
                slot="activator"
                small
                class="mr-4"
                @click="deleteItem(props.item)"
            >
              delete
            </v-icon>
            <span>Delete</span>
          </v-tooltip>
        </td>
      </template>
      <template slot="no-data">
        <td colspan="2">Scan the page or add a single element to build the model</td>
      </template>
    </v-data-table>
    <confirm ref="confirm"></confirm>
  </div>
</template>
<script>
import Confirm from '../Confirm';
export default {
  name: 'Table',
  components: { Confirm },
  props: ['model'],
  data() {
    return {
      dialog: false,
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
      editedIndex: -1,
      currentLocator: {},
      editedItem: {
        name: '',
        locators: [],
      },
      defaultItem: {
        name: '',
        locators: [],
      },
    };
  },
  watch: {
    dialog(val) {
      val || this.close();
    },
  },
  methods: {
    editItem(item) {
      this.editedIndex = this.model.entities.indexOf(item);
      this.editedItem = Object.assign({}, item);
      this.currentLocator = this.editedItem.locators.find(l => l.selected);
      this.dialog = true;
    },

    deleteItem(item) {
      const index = this.model.entities.indexOf(item);
      this.$refs.confirm.open('Delete Element', `Really delete ${item.name}?`).then(confirm => {
        if (confirm) {
          this.model.entities.splice(index, 1);
        }
      });
    },

    close() {
      this.dialog = false;
      setTimeout(() => {
        this.editedItem = Object.assign({}, this.defaultItem);
        this.editedIndex = -1;
      }, 200);
    },

    save() {
      if (this.editedIndex > -1) {
        delete this.editedItem.locators.find(l => l.selected).selected;
        this.editedItem.locators.find(l => l.name === this.currentLocator.name).selected = true;
        Object.assign(this.model.entities[this.editedIndex], this.editedItem);
      }
      this.close();
    },
  },
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
