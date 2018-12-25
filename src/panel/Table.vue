<template>
  <div class="model-table">
    <v-dialog v-model="dialog" @keydown.enter="save">
      <form>
        <v-card>
          <v-card-title class="pa-2"> <span class="headline">Edit Element</span> </v-card-title>
          <v-card-text class="pb-1">
            <v-container grid-list-md pa-0>
              <v-layout wrap>
                <v-flex>
                  <v-text-field
                    v-model="editedItemName"
                    label="Name"
                    :error-messages="editedItemNameErrors"
                    required
                    @input="$v.editedItemName.$touch()"
                    @blur="$v.editedItemName.$touch()"
                  ></v-text-field>
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
                </v-flex>
                <v-flex>
                  <v-text-field v-model="currentLocator.locator" :append-icon="'remove_red_eye'">
                    <v-tooltip left open-delay="1000" slot="append" :disabled="!showTooltips">
                      <v-icon slot="activator" small class="mr-2 pa-1" @click="showMatchesForLocator(currentLocator)"> remove_red_eye </v-icon>
                      <span>View Matched Elements</span>
                    </v-tooltip>
                  </v-text-field>
                </v-flex>
              </v-layout>
            </v-container>
          </v-card-text>
          <v-card-actions class="py-1">
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" flat @click.native="dialog = false">Cancel</v-btn>
            <v-btn color="blue darken-1" flat @click.native="save">Save</v-btn>
          </v-card-actions>
        </v-card>
      </form>
    </v-dialog>
    <v-data-table :items="model == null ? [] : model.entities" :headers="headers" hide-actions class="elevation-0">
      <template slot="items" slot-scope="props">
        <tr v-on:dblclick="editItem(props.item)" @click="showMatchesForEntity(props.item, true)">
          <td class="unselectable" v-bind:class="{ disabled: isInspecting }">{{ props.item.name }}</td>
          <td class="unselectable" v-bind:class="{ disabled: isInspecting }">{{ itemLocator(props.item) }}</td>
          <td class="text-xs-right px-0 unselectable">
            <v-tooltip left open-delay="1000" :disabled="!showTooltips || isInspecting">
              <v-icon slot="activator" small class="mr-2 pa-1" @click="showMatchesForEntity(props.item)" :disabled="isInspecting"> remove_red_eye </v-icon>
              <span>View Matched Elements</span>
            </v-tooltip>
            <v-tooltip left open-delay="1000" :disabled="!showTooltips || isInspecting">
              <v-icon slot="activator" small class="mr-2 pa-1" @click="editItem(props.item)" :disabled="isInspecting"> edit </v-icon>
              <span>Edit</span>
            </v-tooltip>
            <v-tooltip left open-delay="1000" :disabled="!showTooltips || isInspecting">
              <v-icon slot="activator" small class="mr-4 pa-1" @click="deleteItem(props.item)" :disabled="isInspecting"> delete </v-icon>
              <span>Delete</span>
            </v-tooltip>
          </td>
        </tr>
      </template>
      <template slot="no-data">
        <td colspan="3">Scan the page or start adding elements to build the model</td>
      </template>
    </v-data-table>
  </div>
</template>
<script>
import upperFirst from 'lodash/upperFirst';
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import defaultOptions from '../options/defaultOptions';

export default {
  mixins: [validationMixin],
  validations() {
    return {
      editedItemName: { required, uniqueName: this.uniqueName },
      currentLocator: { required },
    };
  },
  name: 'Table',
  props: ['isInspecting', 'model', 'showTooltips'],
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
          text: 'Locator',
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
      originalItem: {
        name: '',
        tagName: '',
        type: '',
        locators: [],
      },
      editedItem: {
        name: '',
        tagName: '',
        type: '',
        locators: [],
      },
      editedItemName: '',
      defaultItem: {
        name: '',
        tagName: '',
        type: '',
        locators: [],
      },
      options: defaultOptions,
    };
  },
  computed: {
    editedItemNameErrors() {
      const errors = [];
      if (!this.$v.editedItemName.$dirty) {
        return errors;
      }
      if (!this.$v.editedItemName.required) {
        errors.push('Name is required.');
      }
      if (!this.$v.editedItemName.uniqueName) {
        errors.push('Name must be unique.');
      }
      return errors;
    },
  },
  watch: {
    dialog(active) {
      if (active) {
        return;
      }
      this.close();
    },
  },
  methods: {
    uniqueName(n) {
      const res = this.model.entities.filter(e => e.name === n);
      return res.length === 0 || n === this.editedItem.name;
    },
    editItem(item) {
      if (this.isInspecting) {
        return;
      }
      this.editedIndex = this.model.entities.indexOf(item);
      this.editedItem = Object.assign({}, item);
      this.editedItem.locators = item.locators.filter(l => !l.hidden);
      this.originalItem = JSON.parse(JSON.stringify(Object.assign({}, item)));
      this.editedItemName = this.editedItem.name;
      this.currentLocator = this.editedItem.locators.find(l => l.selected);
      this.dialog = true;
    },
    deleteItem(item) {
      const index = this.model.entities.indexOf(item);
      this.$root.$confirm('Delete Element', `Really delete ${item.name}?`).then(confirm => {
        if (confirm) {
          this.model.entities.splice(index, 1);
          if (item.name in this.model.usedNames) {
            delete this.model.usedNames[item.name];
          }
          if (this.model.entities.length === 0) {
            this.$emit('emptyModel');
          }
        }
      });
    },
    close(saved = false) {
      setTimeout(() => {
        if (!saved && this.editedIndex > -1) {
          Object.assign(this.model.entities[this.editedIndex], this.originalItem);
        }
        this.editedItemName = this.defaultItem.name;
        this.editedItem = Object.assign({}, this.defaultItem);
        this.editedIndex = -1;
        this.$v.$reset();
        this.dialog = false;
      }, 200);
    },
    save() {
      this.$v.$touch();
      if (!this.$v.$invalid) {
        delete this.editedItem.locators.find(l => l.selected).selected;
        this.editedItem.locators.find(l => l.name === this.currentLocator.name).selected = true;
        this.editedItem.name = upperFirst(this.editedItemName);
        Object.assign(this.model.entities[this.editedIndex], this.editedItem);
        this.close(true);
      }
    },
    itemLocator(item) {
      const current = item.locators.find(l => l.selected === true);
      return `${current.name}: ${current.locator}`;
    },
    showMatchesForLocator(locator) {
      chrome.runtime.sendMessage({ type: 'appShowMatches', data: { locator } });
    },
    showMatchesForEntity(entity, tableClick = false) {
      if (tableClick && !this.options.clickTableRowsToViewMatchedElements) {
        return;
      }
      const locator = entity.locators.find(l => l.selected);
      this.showMatchesForLocator(locator);
    },
    loadOptions() {
      chrome.storage.sync.get(['options'], result => {
        if (result) {
          if (result.options) {
            this.options = result.options;
          }
        }
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import '../styles/colours';
@import '../styles/material';
@import '../styles/buttons';

.model-table {
  margin: 6em 2em 0 2em;
}

.unselectable {
  -moz-user-select: -moz-none;
  -khtml-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.disabled {
  opacity: 0.6;
}
</style>
