<template>
  <v-dialog v-model="dialog" fullscreen hide-overlay transition="dialog-bottom-transition">
    <v-form >
     <v-card>
       <v-card-title class="pa-2">
         <span class="headline">Modelling Profile</span>
       </v-card-title>
       <v-card-text class="pb-2">
         <p class="body-1">Modelling profiles are used to define the locators used to identify page elements and the code template which is used to output the model. You can use an existing in-built profile or create a custom profile and template to suit your needs.</p>
       </v-card-text>
       <v-card-actions class="py-1">
         <v-spacer></v-spacer>
         <v-btn color="blue darken-1" flat @click.native="close">Ok</v-btn>
       </v-card-actions>
     </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
export default {
  data: () => ({
    dialog: false,
  }),
  methods: {
    show(firstShow) {
      this.dialog = true;
    },
    close() {
      this.dialog = false;
    },
  },
};
</script>

<style scoped>
</style>
