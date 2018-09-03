<template>
  <v-dialog v-model="dialog" :max-width="options.width" @keydown.esc="cancel">
    <v-card>
      <v-toolbar dark :color="options.color" dense flat>
        <v-toolbar-title class="white--text">{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text v-show="!!message" class="body-1">{{ message }}</v-card-text>
      <v-card-actions class="pt-0">
        <v-spacer></v-spacer>
        <v-btn color="primary darken-1" flat="flat" @click.native="ok">Ok</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
/**
 * Vuetify Alert Dialog component
 *
 * Insert component where you want to use it:
 * <alert ref="alert"></confirm>
 *
 * Call it:
 * this.$refs.alert.open('Uh Oh', 'Message text', { color: 'red' });
 *
 * Alternatively you can place it in main App component and access it globally via this.$root.$alert
 * <template>
 *   <v-app>
 *   ...
 *   <alert ref="alert"></alert>
 *   </v-app>
 * </template>
 *
 * mounted() {
 *   this.$root.$alert = this.$refs.alert.open
 * }
 */
export default {
  data: () => ({
    dialog: false,
    message: null,
    title: null,
    options: {
      color: 'primary',
      width: 490,
    },
  }),
  methods: {
    open(title, message, options) {
      this.dialog = true;
      this.title = title;
      this.message = message;
      this.options = Object.assign(this.options, options);
    },
    ok() {
      this.dialog = false;
    },
  },
};
</script>

<style scoped>
</style>
