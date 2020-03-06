<template>
  <v-app-bar dense fixed>
    <v-tooltip bottom :disabled="!showTooltips || hasModel || isAdding" open-delay="600">
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" ref="btn-scan" id="btn-scan" icon :disabled="hasModel || isAdding" v-on:click="scan" v-bind:class="{ active: isScanning }">
          <v-icon>{{ mdiFileFind }}</v-icon>
        </v-btn>
      </template>
      <span v-if="!isInspecting">Scan Page</span> <span v-if="isScanning">Stop Scanning</span>
    </v-tooltip>

    <v-tooltip bottom :disabled="!showTooltips || !hasModel || isInspecting" open-delay="600">
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" icon :disabled="!hasModel || isInspecting" v-on:click="deleteModel">
          <v-icon>{{ mdiDeleteSweep }}</v-icon>
        </v-btn>
      </template>
      <span>Delete Model</span>
    </v-tooltip>

    <v-tooltip bottom :disabled="!showTooltips || hasModel || isInspecting" open-delay="600">
      <template v-slot:activator="{ on: tooltip }">
        <v-menu :nudge-width="100" :disabled="hasModel || isInspecting">
          <template v-slot:activator="{ on: menu }">
            <v-btn v-on="{ ...tooltip, ...menu }" text rounded class="text-capitalize" :disabled="hasModel || isInspecting"
              >{{ activeProfile }}
              <v-icon>{{ mdiMenuDown }}</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item v-for="item in profileList" :key="item.name" @click="selectProfile(item)"> <v-list-item-title v-text="item.name"></v-list-item-title> </v-list-item>
          </v-list>
        </v-menu>
      </template>
      <span>Select Modelling Profile</span>
    </v-tooltip>

    <v-spacer></v-spacer>

    <v-tooltip bottom :disabled="!showTooltips || isScanning" open-delay="600">
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" :disabled="isScanning" icon v-on:click="add" v-bind:class="{ active: isAdding }">
          <v-icon>{{ mdiPlaylistPlus }}</v-icon>
        </v-btn>
      </template>
      <span v-if="!isInspecting">Add Element</span> <span v-if="isAdding">Stop Adding Element</span>
    </v-tooltip>

    <v-tooltip bottom :disabled="!showTooltips || (!hasModel && !isInspecting)" open-delay="600">
      <template v-slot:activator="{ on }">
        <v-btn v-on="on" icon :disabled="!hasModel || isInspecting" v-on:click="generateModel">
          <v-icon>{{ mdiCodeTags }}</v-icon>
        </v-btn>
      </template>
      <span>Generate Code</span>
    </v-tooltip>
  </v-app-bar>
</template>
<script>
import { mdiFileFind, mdiDeleteSweep, mdiMenuDown, mdiPlaylistPlus, mdiCodeTags, mdiEye, mdiPencil, mdiDelete } from '@mdi/js';

export default {
  name: 'Toolbar',
  props: ['isInspecting', 'isScanning', 'isAdding', 'hasModel', 'profileList', 'activeProfile', 'showTooltips'],
  data() {
    return {
      mdiFileFind,
      mdiDeleteSweep,
      mdiMenuDown,
      mdiPlaylistPlus,
      mdiCodeTags,
      mdiEye,
      mdiPencil,
      mdiDelete,
    };
  },
  methods: {
    scan() {
      this.$emit('scan');
    },
    add() {
      this.$emit('add');
    },
    deleteModel() {
      this.$emit('deleteModel');
    },
    generateModel() {
      this.$emit('generateModel');
    },
    selectProfile(profile) {
      this.profileList.find(p => p.active).active = false;
      this.profileList.find(p => p.name === profile.name).active = true;
      this.$emit('activateProfile', profile.name);
    },
  },
};
</script>

<style scoped lang="scss">
@import '../styles/colours';
@import '../styles/buttons';
</style>
