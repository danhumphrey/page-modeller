<template>
    <v-app>
        <v-toolbar dense>
            <v-toolbar-title>{{ title }}</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-toolbar-items >
                <v-btn flat>Link</v-btn>
                <v-btn flat>Link</v-btn>
            </v-toolbar-items>
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
