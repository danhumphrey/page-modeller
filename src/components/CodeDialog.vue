<template>
  <v-dialog scrollable v-model="dialog" @keydown.esc="cancel">
    <v-card>
      <v-toolbar dark dense flat>
        <v-toolbar-title class="white--text">{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text style="height: 450px">
        <pre>
          {{ code }}
        </pre>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="copy">Copy</v-btn>
        <v-btn text @click="ok">Ok</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'CodeDialog', // Added component name for consistency
  data: () => ({
    dialog: false,
    code: null,
    title: null,
  }),
  methods: {
    show(title, code) {
      this.dialog = true;
      this.title = title;
      this.code = code;
    },
    ok() {
      this.dialog = false;
    },
    cancel() {
      // Added cancel method for keydown.esc
      this.dialog = false;
    },
    copy() {
      const copyEl = document.createElement('pre');
      copyEl.setAttribute('style', 'height: 0px');
      copyEl.contentEditable = 'true';
      document.body.appendChild(copyEl);
      copyEl.appendChild(document.createTextNode(this.code));
      copyEl.unselectable = 'off';
      copyEl.focus();
      document.execCommand('SelectAll');
      document.execCommand('Copy', false, null);
      document.body.removeChild(copyEl);
      this.dialog = false;
      this.$root.$popupSuccess('The code has been copied to your clipboard');
    },
  },
};
</script>

<style scoped lang="scss">
@import '../styles/colours';
@import '../styles/buttons';
pre {
  font-size: 11px;
}
</style>
