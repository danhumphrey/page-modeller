<template>
  <v-app>
    <v-card >
      <v-card-text>
        <v-form>
          <v-layout row wrap>
            <v-flex xs12>
              <v-switch label="Show Tooltips"
                        v-model="showTooltips">
              </v-switch>
              <v-switch label="Model Hidden Elements"
                        v-model="modelHiddenElements">
              </v-switch>
            </v-flex>
          </v-layout>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" flat @click.native="save" :disabled="unchanged">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-app>
</template>
<script>
import defaultOptions from './defaultOptions';

export default {
  name: 'options',
  components: {},
  data() {
    return {
      unchanged: true,
      showTooltips: defaultOptions.showTooltips,
      modelHiddenElements: defaultOptions.modelHiddenElements,
      originalOptions: defaultOptions,
    };
  },
  methods: {
    save() {
      chrome.runtime.sendMessage({
        type: 'saveOptions',
        data: {
          options: {
            showTooltips: this.showTooltips,
            modelHiddenElements: this.modelHiddenElements,
          },
        },
      });
      this.unchanged = true;
    },
  },
  mounted() {
    chrome.storage.sync.get(['options'], result => {
      if (result) {
        if (result.options) {
          this.originalOptions = JSON.parse(JSON.stringify(result.options));
          this.showTooltips = this.originalOptions.showTooltips;
          this.modelHiddenElements = this.originalOptions.modelHiddenElements;
          this.options = result.options;
        } else {
          // no options saved, so save defaults
          this.originalOptions = defaultOptions;
          chrome.runtime.sendMessage({ type: 'saveOptions', data: { options: defaultOptions } });
        }
      }
    });
  },
  watch: {
    showTooltips(val) {
      if (this.originalOptions.showTooltips !== val) {
        this.unchanged = false;
      }
    },
    modelHiddenElements(val) {
      if (this.originalOptions.modelHiddenElements !== val) {
        this.unchanged = false;
      }
    },
  },
};
</script>
<style scoped lang="scss">
@import '../styles/material';
@import '../styles/buttons';
.v-list__tile__action {
  min-width: 16px !important;
  width: 32px !important;
}
</style>

<style lang="scss">
@import '../styles/colours';
</style>
