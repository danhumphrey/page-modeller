<template>
  <v-app>
    <v-card>
      <v-card-text class="body-1">Please open DevTools to use the Page Modeller extension.</v-card-text>
      <v-card-actions class="pt-0">
        <v-spacer></v-spacer>
        <v-btn flat small color="primary" v-on:click="openSupport">Support</v-btn><v-btn flat small color="primary" v-on:click="openOptions">Options</v-btn>
      </v-card-actions>
    </v-card>
  </v-app>
</template>

<script>
export default {
  data() {
    return {};
  },
  methods: {
    openOptions() {
      chrome.runtime.openOptionsPage();
    },
    openSupport() {
      chrome.tabs.create({ url: 'https://github.com/danhumphrey/page-modeller' });
    },
  },
};
</script>

<style lang="scss">
body {
  width: 260px;
}
</style>
