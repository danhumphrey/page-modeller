<template>
    <v-app>
        <Toolbar @scan="scan" :is-inspecting="isInspecting" :is-adding="isAdding" :is-scanning="isScanning" :has-model="hasModel"/>
        <Table :model="model" :is-inspecting="isInspecting" :is-adding="isAdding" :is-scanning="isScanning"/>
    </v-app>
</template>

<script>
import Toolbar from './Toolbar';
import Table from './Table';

export default {
  name: 'app',
  components: { Table, Toolbar },
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
    scan: function(e) {
      this.$data.isScanning = !this.$data.isScanning;

      if (this.isScanning) {
        chrome.runtime.sendMessage({ type: 'appStartScanning', data: {} });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopScanning', data: {} });
      }
    },
  },
  mounted: function() {
    this.$nextTick(function() {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg.type === 'elementInspected') {
          console.log('elementInspected message received');
          console.log(msg.data.model);
          this.$data.isScanning = false;
          this.$data.isAdding = false;
          this.$data.model = msg.data.model;
        }
      });
    });
  },
};
</script>
<style scoped lang="scss">
</style>
