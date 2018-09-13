<template>
  <v-app>
    <v-toolbar tabs>
      <v-toolbar-title>Page Modeller</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-tabs
        slider-color="highlight"
        slot="extension"
        v-model="model"
        color="transparent"
      >
        <v-tab>
          Options
        </v-tab>
        <v-tab>
          Profiles
        </v-tab>
      </v-tabs>
    </v-toolbar>
    <v-tabs-items v-model="model">
      <v-tab-item>
        <v-card >
          <v-card-text>Options tab content</v-card-text>
        </v-card>
      </v-tab-item>
      <v-tab-item>
        <v-card >
          <v-card-text>
            <v-form>
              <v-layout row wrap>
                <v-flex xs12>
                  <v-card flat>
                    <v-card-text>
                      <p class="body-1">Modelling profiles are used to define the locators and code template which is used to output the model. You can use an existing in-built profile or create a custom profile and template to suit your needs.</p>
                    </v-card-text>
                  </v-card>
                </v-flex>
                <v-flex xs4>
                  <v-card flat>
                    <v-card-text>
                      <v-list>
                        <v-list-tile
                          v-for="item in profiles"
                          :key="item.name"
                          v-model="item.active"
                          @click="activateProfile(item)"
                          active-class="active-profile"
                        >
                          <v-list-tile-content>
                            <v-list-tile-title v-text="item.name"></v-list-tile-title>
                          </v-list-tile-content>

                          <v-list-tile-action>
                            <v-tooltip left open-delay="1000">
                              <v-icon
                                slot="activator"
                                small
                                @click="editItem(props.item)"
                              >
                                edit
                              </v-icon>
                              <span>Rename</span>
                            </v-tooltip>
                          </v-list-tile-action>
                          <v-list-tile-action>
                            <v-tooltip left open-delay="1000">
                              <v-icon
                                slot="activator"
                                small
                                @click="deleteItem(props.item)"
                              >
                                delete
                              </v-icon>
                              <span>Delete</span>
                            </v-tooltip>
                          </v-list-tile-action>
                        </v-list-tile>
                        <v-btn
                          color="grey lighten-1"
                          fab
                          dark
                          small
                          absolute
                          top
                          left
                          class="ml-3"
                        >
                          <v-icon style="height:auto;">add</v-icon>
                        </v-btn>
                      </v-list>
                    </v-card-text>
                  </v-card>
                </v-flex>
                <v-flex xs8>
                  <v-select
                    v-model="selectedLocators"
                    :items="locators"
                    chips
                    small-chips
                    label="Enabled Locators"
                    multiple
                  >
                  </v-select>

                  <v-textarea
                    solo
                    name="template"
                    value=""
                    rows="16"
                  ></v-textarea>
                </v-flex>
              </v-layout>
            </v-form>
          </v-card-text>
        </v-card>
      </v-tab-item>
    </v-tabs-items>
  </v-app>
</template>
<script>
export default {
  name: 'options',
  data() {
    return {
      model: '',
      locators: ['ID', 'Link Text', 'Partial Link Text', 'Name', 'CSS', 'Class Name', 'XPath', 'Tag Index'],
      selectedLocators: ['ID', 'Link Text', 'Partial Link Text', 'Name', 'CSS', 'Class Name'],
      profiles: [
        {
          name: 'Selenium WebDriver Java',
          active: true,
        },
        {
          name: 'Selenium WebDriver C#',
          active: false,
        },
        {
          name: 'Puppeteer',
          active: false,
        },
        {
          name: 'Cypress',
          active: false,
        },
        {
          name: 'Chromeless',
          active: false,
        },
      ],
    };
  },
  methods: {
    activateProfile(profile) {
      this.profiles.find(p => p.active).active = false;
      profile.active = true;
    },
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

.active-profile {
  color: $blue !important;
}
</style>
