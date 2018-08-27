<template>
    <v-toolbar dense>
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

        <v-spacer></v-spacer>
        <!--


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
        <v-tooltip bottom :disabled="!hasModel && !isInspecting" open-delay="600">
            <v-btn slot="activator" icon :disabled="!hasModel || isInspecting">
                <v-icon>code</v-icon>
            </v-btn>
            <span>Generate Code</span>
        </v-tooltip>

    </v-toolbar>
</template>

<script>
export default {
  name: 'Toolbar',
  props: ['isInspecting', 'isScanning', 'isAdding', 'hasModel'],
  methods: {
    scan: function() {
      this.$emit('scan');
    },
    deleteModel: function() {
      this.$emit('deleteModel');
    },
  },
};
</script>

<style scoped lang="scss">
@import '../styles/settings';
@import '../styles/material';
@import '../styles/buttons';
</style>
