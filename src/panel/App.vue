<template>
  <v-app>
    <Toolbar @scan="scan" @add="add" @deleteModel="deleteModel" @generateModel="generateModel" :is-inspecting="isInspecting" :is-adding="isAdding" :is-scanning="isScanning" :has-model="hasModel"/>
    <Table  :model="model" />
    <alert ref="alert"></alert>
  </v-app>
</template>

<script>
import Alert from '../Alert';
import Toolbar from './Toolbar';
import Table from './Table';
import ModelBuilder from '../ModelBuilder';

export default {
  name: 'app',
  components: { Table, Toolbar, Alert },
  computed: {
    isInspecting: function() {
      return this.isAdding || this.isScanning;
    },
    hasModel: function() {
      return this.model !== null;
    },
  },
  data: function() {
    return {
      isScanning: false,
      isAdding: false,
      model: null,
    };
  },
  methods: {
    scan: function() {
      this.$data.isScanning = !this.$data.isScanning;

      if (this.isScanning) {
        chrome.runtime.sendMessage({ type: 'appStartScanning', data: {} });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
    add: function() {
      this.$data.isAdding = !this.$data.isAdding;

      if (this.isAdding) {
        chrome.runtime.sendMessage({ type: 'appStartAdding', data: { model: this.$data.model === null ? ModelBuilder.createEmptyModel() : this.$data.model } });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
    deleteModel: function() {
      this.$data.model = null;
    },
    generateModel: function() {
      console.log('Generate Model:');
      console.log(this.$data.model);
    },
  },
  mounted: function() {
    this.$root.$alert = this.$refs.alert.open;

    this.$nextTick(function() {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg.type === 'alertMessage') {
          this.$root.$alert(msg.data.title || 'Page Modeller', msg.data.message);
        }

        if (msg.type === 'elementInspected') {
          console.log('elementInspected message received');
          console.log(msg.data.model);

          this.$data.model = msg.data.model;

          if (this.$data.isAdding) {
            setTimeout(() => (document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight), 100);
          }
          this.$data.isScanning = false;
          this.$data.isAdding = false;
        }
      });
    });
  },
};
</script>
<style scoped lang="scss">
</style>
