<template>
    <v-app>
        <Toolbar @inspect="inspect" :is-inspecting="isInspecting" :has-model="hasModel"/>
    </v-app>
</template>

<script>
import Toolbar from './Toolbar';

export default {
  name: 'app',
  components: { Toolbar },
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
          console.log(msg.data);
          this.$data.isInspecting = false;
        }
      });
    });
  },
};
</script>
<style scoped lang="scss">
</style>
