<template>
  <v-snackbar v-model="snackbar" :timeout="timeout">
    <v-layout justify-start row>
      <v-icon v-if="warningIcon" color="yellow darken-2">warning</v-icon>
      <v-icon v-if="errorIcon" color="red darken-2">error</v-icon>
      <v-icon v-if="infoIcon" color="blue darken-2">info</v-icon>
      <v-icon v-if="successIcon" color="green darken-2">check_circle</v-icon>
      <span class="message">{{ message }}</span>
    </v-layout>
    <v-btn flat @click="close"> Close </v-btn>
  </v-snackbar>
</template>

<script>
export default {
  props: ['darkMode'],
  data: () => ({
    snackbar: false,
    timeout: 3000,
    message: null,
    infoIcon: false,
    warningIcon: false,
    errorIcon: false,
    successIcon: false,
  }),
  methods: {
    show(message, timeout) {
      this.message = message;
      this.timeout = timeout;
      this.snackbar = true;
    },
    info(message, timeout = 3000) {
      this.reset();
      this.infoIcon = true;
      this.show(message, timeout);
    },
    warning(message, timeout = 3000) {
      this.reset();
      this.warningIcon = true;
      this.show(message, timeout);
    },
    error(message, timeout = 3000) {
      this.reset();
      this.errorIcon = true;
      this.show(message, timeout);
    },
    success(message, timeout = 3000) {
      this.reset();
      this.successIcon = true;
      this.show(message, timeout);
    },
    reset() {
      this.infoIcon = false;
      this.errorIcon = false;
      this.warningIcon = false;
      this.successIcon = false;
    },
    close() {
      this.snackbar = false;
    },
  },
};
</script>

<style scoped lang="scss">
.message {
  margin-left: 1em;
}
</style>
