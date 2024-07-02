<template>
  <v-app>
    <v-card>
      <v-card-text class="body-2 pb-0 pt-2">
        <h1 class="title mb-2">Page Modeller {{ version }}</h1>
        <p>To use the Page Modeller extension, please open DevTools:</p>
        <p v-if="isMac"><kbd>Command</kbd> + <kbd>Option</kbd> + <kbd>I</kbd></p>
        <p v-else><kbd>Control</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd></p>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text small v-on:click="openSupport">Support</v-btn>
        <v-btn text small v-on:click="openOptions">Options</v-btn>
      </v-card-actions>
    </v-card>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      version: '2.5.1',
      isMac: navigator.userAgent.toUpperCase().includes('MAC'),
    };
  },
  methods: {
    openOptions() {
      chrome.runtime.openOptionsPage();
      window.close();
    },
    openSupport() {
      chrome.tabs.create({ url: 'https://github.com/danhumphrey/page-modeller' });
      window.close();
    },
  },
};
</script>

<style lang="scss">
body {
  width: 260px;
}
</style>

<style lang="scss" scoped>
h1.title {
  color: #000;
}
@import '../styles/colours';
@import '../styles/buttons';
</style>
