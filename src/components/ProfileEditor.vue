<template>
  <v-dialog v-model="dialog" fullscreen hide-overlay transition="dialog-bottom-transition">
    <v-form>
     <v-card>
       <v-card-title>
         <span class="headline">Modelling Profile</span>
       </v-card-title>
       <v-card-text >

       </v-card-text>
       <v-card-actions >
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
