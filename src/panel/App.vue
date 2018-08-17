<template>
    <v-app>
        <v-toolbar dense>
            <v-tooltip bottom open-delay="600">
                <v-btn slot="activator" ref="btn-scan" id="btn-scan" icon v-on:click="inspect" v-bind:class="{active: appData.isInspecting}">
                    <v-icon>find_in_page</v-icon>
                </v-btn>
                <span v-if="!appData.isInspecting">Scan Page</span>
                <span v-if="appData.isInspecting">Stop Scanning</span>

            </v-tooltip>

            <v-tooltip bottom :disabled="!appData.hasModel" open-delay="600">
                <v-btn slot="activator" icon disabled >
                    <v-icon>delete_sweep</v-icon>
                </v-btn>
                <span>Delete All Elements</span>
            </v-tooltip>

            <v-spacer></v-spacer>
            <!--
            <v-tooltip bottom open-delay="600">
                <v-btn slot="activator" icon>
                    <v-icon>playlist_add</v-icon>
                </v-btn>
                <span>Add Element</span>
            </v-tooltip>

            <v-tooltip bottom open-delay="600">
                <v-btn slot="activator" icon>
                    <v-icon>delete</v-icon>
                </v-btn>
                <span>Delete Item</span>
            </v-tooltip>

            <v-tooltip bottom open-delay="600">
                <v-btn slot="activator" icon>
                    <v-icon>remove_red_eye</v-icon>
                </v-btn>
                <span>View Matches</span>
            </v-tooltip>
            -->
            <v-tooltip bottom :disabled="!appData.hasModel" open-delay="600">
                <v-btn slot="activator" icon disabled>
                    <v-icon>code</v-icon>
                </v-btn>
                <span>Generate Code</span>
            </v-tooltip>

        </v-toolbar>
    </v-app>
</template>

<script>
export default {
  name: 'app',
  props: {
    appData: {
      default: function() {
        return {
          isInspecting: false,
          hasModel: false,
        };
      },
      type: Object,
    },
  },
  methods: {
    inspect: function(e) {
      this.appData.isInspecting = !this.appData.isInspecting;

      if (this.appData.isInspecting) {
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
          this.appData.isInspecting = false;
        }
      });
    });
  },
};
</script>
<style scoped lang="scss">
@import '../styles/settings.scss';
@import '../styles/material';

button {
  &:hover {
    color: $highlight;
  }
  &.active {
    background: $highlight;
    color: $active-highlight;
  }
}
</style>
