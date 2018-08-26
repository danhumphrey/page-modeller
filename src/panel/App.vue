<template>
    <v-app>
        <Toolbar @inspect="inspect" :is-inspecting="isInspecting" :has-model="hasModel"/>
        <Table />
    </v-app>
</template>

<script>
import Toolbar from './Toolbar';
import Table from './Table';

export default {
  name: 'app',
  components: { Table, Toolbar },
  data: function() {
    return {
      isInspecting: false,
      hasModel: false,
    };
  },
  methods: {
    inspect: function(e) {
      this.$data.isInspecting = !this.$data.isInspecting;

      if (this.isInspecting) {
        chrome.runtime.sendMessage({ type: 'appStartInspecting', data: {} });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
  },
  mounted: function() {
    this.$nextTick(function() {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg.type === 'elementInspected') {
          console.log('elementInspected message received');
          console.log(msg.data.model);
          this.$data.isInspecting = false;
        }
      });
    });
  },
};
</script>
<style scoped lang="scss">
</style>
