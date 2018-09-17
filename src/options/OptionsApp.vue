<template>
  <v-app>
    <h1>Options</h1>
  </v-app>
</template>
<script>
export default {
  name: 'options',
  data() {
    return {
      editing: false,
    };
  },
};
</script>
<style scoped lang="scss">
@import '../styles/material';
@import '../styles/buttons';
.v-list__tile__action {
  min-width: 16px !important;
  width: 32px !important;
}
</style>

<style lang="scss">
@import '../styles/colours';
</style>
