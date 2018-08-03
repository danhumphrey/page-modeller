<template>
    <v-app>
        <v-toolbar dense>

            <v-btn icon>
                <v-icon>find_in_page</v-icon>
            </v-btn>
            <v-btn icon>
                <v-icon>delete_sweep</v-icon>
            </v-btn>
            <v-spacer></v-spacer>


            <v-btn icon>
                <v-icon>playlist_add</v-icon>
            </v-btn>
            <v-btn icon>
                <v-icon>delete</v-icon>
            </v-btn>

            <v-btn icon>
                <v-icon>remove_red_eye</v-icon>
            </v-btn>

            <v-btn icon>
                <v-icon>code</v-icon>
            </v-btn>

        </v-toolbar>
    </v-app>
</template>

<script>
export default {
  name: 'app',
  data() {
    return {
      title: 'Page Modeller',
    };
  },
};
</script>
