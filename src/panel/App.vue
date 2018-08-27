<template>
    <v-app>
        <Toolbar @scan="scan" @deleteModel="deleteModel" :is-inspecting="isInspecting" :is-adding="isAdding" :is-scanning="isScanning" :has-model="hasModel"/>
        <Table @add="add" :has-model="hasModel" :model="model" :is-inspecting="isInspecting" :is-adding="isAdding" :is-scanning="isScanning"/>
    </v-app>
</template>

<script>
import Toolbar from './Toolbar';
import Table from './Table';
import Model from '../model/Model';

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
        chrome.runtime.sendMessage({ type: 'appStartAdding', data: {} });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
    deleteModel: function() {
      this.$data.model = null;
    },
  },
  mounted: function() {
    this.$nextTick(function() {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg.type === 'elementInspected') {
          console.log('elementInspected message received');
          console.log(msg.data.model);

          if (this.isAdding) {
            const model = new Model();

            for (let entity of this.model.entities) {
              model.addEntity(entity);
            }

            for (let entity of msg.data.model.entities) {
              model.addEntity(entity);
            }

            this.$data.model = model;
          } else {
            this.$data.model = msg.data.model;
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
