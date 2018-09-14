<template>
  <v-toolbar dense fixed>
    <v-tooltip bottom :disabled="hasModel || isAdding" open-delay="600">
      <v-btn slot="activator" ref="btn-scan" id="btn-scan" icon :disabled="hasModel || isAdding" v-on:click="scan" v-bind:class="{active: isScanning}">
        <v-icon>find_in_page</v-icon>
      </v-btn>
      <span v-if="!isInspecting">Scan Page</span>
      <span v-if="isScanning">Stop Scanning</span>
    </v-tooltip>

    <v-tooltip bottom :disabled="!hasModel || isInspecting" open-delay="600">
      <v-btn slot="activator" icon :disabled="!hasModel || isInspecting" v-on:click="deleteModel">
        <v-icon>delete_sweep</v-icon>
      </v-btn>
      <span>Delete Model</span>
    </v-tooltip>

    <v-tooltip bottom :disabled="hasModel || isInspecting" open-delay="600">
      <v-btn flat small round class="text-capitalize" slot="activator" :disabled="hasModel || isInspecting">{{currentProfile}}
        <v-icon>arrow_drop_down</v-icon>
      </v-btn>
      <span>Select Modelling Profile</span>
    </v-tooltip>

    <v-spacer></v-spacer>

    <v-tooltip bottom :disabled="isScanning" open-delay="600">
      <v-btn slot="activator" :disabled="isScanning" icon v-on:click="add" v-bind:class="{active: isAdding}">
        <v-icon>playlist_add</v-icon>
      </v-btn>
      <span v-if="!isInspecting">Add Element</span>
      <span v-if="isAdding">Stop Adding Element</span>
    </v-tooltip>

    <v-tooltip bottom :disabled="!hasModel && !isInspecting" open-delay="600">
      <v-btn slot="activator" icon :disabled="!hasModel || isInspecting" v-on:click="generateModel">
        <v-icon>code</v-icon>
      </v-btn>
      <span>Generate Code</span>
    </v-tooltip>

  </v-toolbar>
</template>
<script>
export default {
  name: 'Toolbar',
  props: ['isInspecting', 'isScanning', 'isAdding', 'hasModel', 'currentProfile'],
  methods: {
    scan: function() {
      this.$emit('scan');
    },
    add: function() {
      this.$emit('add');
    },
    deleteModel: function() {
      this.$emit('deleteModel');
    },
    generateModel: function() {
      this.$emit('generateModel');
    },
  },
};
</script>

<style scoped lang="scss">
@import '../styles/colours';
@import '../styles/material';
@import '../styles/buttons';
</style>
