<template>
  <v-app>
    <v-card>
      <v-card-title primary-title>
        <h1 class="header-title"><img src="icons/icon_32.png" width="24" /> Page Modeller Options</h1>
      </v-card-title>
      <v-card-text>
        <v-form>
          <v-layout row wrap>
            <v-flex xs12>
              <v-switch label="Show Tooltips" v-model="showTooltips"> </v-switch>
              <v-switch label="Dark Mode" v-model="darkMode"> </v-switch>
              <v-switch label="Model Hidden Elements" v-model="modelHiddenElements"> </v-switch>
              <v-switch label="Click Table Rows To View Matched Elements" v-model="clickTableRowsToViewMatchedElements"> </v-switch>
              <v-text-field label="Set Custom Locator Attribute" clearable outlined persistent-hint
                            placeholder="data-id" class="shrink" v-model="customLocator"></v-text-field>
              <v-switch label="Create Name from Custom Locator Value" v-model="useCustomLocatorVal"> </v-switch>
            </v-flex>
          </v-layout>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click.native="save" :disabled="unchanged">Save</v-btn>
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
      darkMode: defaultOptions.darkMode,
      clickTableRowsToViewMatchedElements: defaultOptions.clickTableRowsToViewMatchedElements,
      customLocator: defaultOptions.customLocator,
      useCustomLocatorVal: defaultOptions.useCustomLocatorVal,
      originalOptions: defaultOptions,
    };
  },
  methods: {
    save() {
      const o = {
        showTooltips: this.showTooltips,
        modelHiddenElements: this.modelHiddenElements,
        darkMode: this.darkMode,
        clickTableRowsToViewMatchedElements: this.clickTableRowsToViewMatchedElements,
        customLocator: this.customLocator,
        useCustomLocatorVal: this.useCustomLocatorVal,
      };
      chrome.runtime.sendMessage({
        type: 'saveOptions',
        data: {
          options: o,
        },
      });
      this.unchanged = true;
      this.originalOptions = o;
    },
  },
  mounted() {
    chrome.storage.sync.get(['options'], (result) => {
      if (result) {
        if (result.options) {
          this.originalOptions = JSON.parse(JSON.stringify(result.options));
          this.showTooltips = this.originalOptions.showTooltips;
          this.modelHiddenElements = this.originalOptions.modelHiddenElements;
          this.darkMode = this.originalOptions.darkMode || defaultOptions.darkMode; // default if no saved option for darkMode
          this.clickTableRowsToViewMatchedElements = this.originalOptions.clickTableRowsToViewMatchedElements || defaultOptions.clickTableRowsToViewMatchedElements; // default if no saved options
          this.customLocator = this.originalOptions.customLocator || defaultOptions.customLocator;
          this.useCustomLocatorVal = this.originalOptions.useCustomLocatorVal || defaultOptions.useCustomLocatorVal;
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
    darkMode(val) {
      if (this.originalOptions.darkMode !== val) {
        this.unchanged = false;
      }
      this.$vuetify.theme.dark = val;
    },
    clickTableRowsToViewMatchedElements(val) {
      if (this.originalOptions.clickTableRowsToViewMatchedElements !== val) {
        this.unchanged = false;
      }
    },
    customLocator(val) {
    if (this.originalOptions.customLocator !== val) {
      this.unchanged = false;
      }
    },
    useCustomLocatorVal(val) {
    if (this.originalOptions.useCustomLocatorVal !== val) {
      this.unchanged = false;
      }
    },
  },
};
</script>
<style scoped lang="scss">
@import '../styles/colours';
@import '../styles/buttons';
.v-list__tile__action {
  min-width: 16px !important;
  width: 32px !important;
}
.header-title {
  color: dimgray;
  font-size: 1.8em !important;
  font-weight: 300;
  img {
    margin-top: -4px;
    vertical-align: middle;
  }
}
</style>
