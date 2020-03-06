<template>
  <v-app>
    <v-card>
      <v-card-text class="body-1 pb-0 pt-2">
        <h3>Page Modeller {{ version }}</h3>
        <p>Please open DevTools to use the Page Modeller extension.</p>
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
      version: '1.5.8',
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
@import '../styles/colours';
@import '../styles/material';
@import '../styles/buttons';
</style>
