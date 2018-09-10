<template>
    <v-app class="appStyle">
      <v-container grid-list-md fluid >
        <v-layout row wrap>
          <!-- <v-flex xs12>
            <v-card flat>
              <v-card-text class="pa-0 mx-0"><p class="body-1">Modelling profiles are used to define the locators and code template which is used to output the model. You can use an existing in-built profile or create a custom profile and template to suit your needs.</p></v-card-text>
            </v-card>
          </v-flex>
          -->
          <v-flex xs12 >
            <v-card flat>
              <v-select
                      label="Current Profile"
                      :items="profiles"
              ></v-select>
            </v-card>
          </v-flex>
          <v-flex xs12>
            <v-select
                    v-model="value"
                    :items="locators"
                    attach
                    chips
                    label="Enabled Locators"
                    multiple
            ></v-select>
          </v-flex>
          <v-flex xs12>
            <v-textarea
                    solo
                    name="template"
                    value=""
                    rows="12"
            ></v-textarea>
          </v-flex>
        </v-layout>
      </v-container>
      <v-footer
        fixed>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" flat @click.native="Ok">Ok</v-btn>
      </v-footer>
    </v-app>
</template>
<script>
export default {
  name: 'options',
  components: {},
  props: ['profiles'],
  data() {
    return {
      locators: ['ID', 'Link Text', 'Partial Link Text', 'Name', 'CSS', 'Class Name', 'XPath', 'Tag Index'],
      selectedLocators: [],
    };
  },
};
</script>
<style lang="scss">
.application,
.v-footer {
  background-color: white !important;
}

.input-small {
  font-size: 80% !important;
}
</style>
