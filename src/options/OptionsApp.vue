<template>
  <v-app>
    <v-toolbar tabs>
      <v-toolbar-title>Page Modeller</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-tabs
        slider-color="highlight"
        slot="extension"
        v-model="tabsModel"
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
    <v-tabs-items v-model="tabsModel">
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
                          :disabled="editing && activeProfile !== item"
                        >
                          <v-list-tile-content>
                            <v-list-tile-title v-text="item.name"></v-list-tile-title>
                          </v-list-tile-content>

                          <v-list-tile-action>
                            <v-tooltip left open-delay="1000" :disabled="editing">
                              <v-icon
                                slot="activator"
                                small
                                @click="editItem(props.item)"
                                :disabled="item.inbuilt || editing"
                              >
                                edit
                              </v-icon>
                              <span v-if="!item.inbuilt">Rename</span>
                              <span v-if="item.inbuilt">Cannot Rename inbuilt profile</span>
                            </v-tooltip>
                          </v-list-tile-action>
                          <v-list-tile-action>
                            <v-tooltip left open-delay="1000" :disabled="editing">
                              <v-icon
                                slot="activator"
                                small
                                @click="deleteItem(props.item)"
                                :disabled="item.inbuilt || editing"
                              >
                                delete
                              </v-icon>
                              <span v-if="!item.inbuilt">Delete</span>
                              <span v-if="item.inbuilt">Cannot Delete inbuilt profile</span>
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
                          @click="create"
                          :disabled="editing"
                        >
                          <v-icon style="height:auto;">add</v-icon>
                        </v-btn>
                      </v-list>
                    </v-card-text>
                  </v-card>
                </v-flex>
                <v-flex xs8>
                  <v-select
                    v-model="activeProfile.locators"
                    :items="locators"
                    chips
                    small-chips
                    label="Enabled Locators"
                    multiple
                    :disabled="activeProfile.inbuilt"
                  >
                  </v-select>
                  <v-textarea
                    solo
                    name="template"
                    v-model="activeTemplate"
                    rows="16"
                    :disabled="activeProfile.inbuilt"
                  ></v-textarea>
                </v-flex>
              </v-layout>
            </v-form>
          </v-card-text>
          <v-card-actions v-if="editing">
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" flat @click.native="cancel">Cancel</v-btn>
            <v-btn color="blue darken-1" flat @click.native="save">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-tab-item>
    </v-tabs-items>
    <ProfileNameEditor
      ref="profileNameEditor"
      @created="created"
    ></ProfileNameEditor>
  </v-app>
</template>
<script>
import ProfileNameEditor from './ProfileNameEditor';
export default {
  name: 'options',
  components: { ProfileNameEditor },
  data() {
    return {
      editing: false,
      tabsModel: '',
      locators: ['ID', 'Link Text', 'Partial Link Text', 'Name', 'CSS', 'Class Name', 'XPath', 'Tag Index'],
      profiles: null,
      activeProfile: {},
      activeTemplate: null,
    };
  },
  methods: {
    loadProfiles() {
      chrome.storage.sync.get('profiles', items => {
        console.log('got profiles from sync');
        console.log(items);
        this.profiles = items.profiles;
        this.activeProfile = this.profiles.find(p => p.active);
        this.loadTemplate(this.activeProfile);
        //test template parsing and model gen
        /*
        const model = {
          entities:[{
            name: 'Forename',
            tagName: 'INPUT',
            type: 'text',
            locators: [{
              name: 'css',
              locator: '#forename',
              selected: true
            }]
          }]
        };
        this.activeTemplate = require(`../templates/${this.activeProfile.template}`)(model);
        */
      });
    },
    activateProfile(profile) {
      this.profiles.find(p => p.active).active = false;
      profile.active = true;
      this.activeProfile = profile;
      this.loadTemplate(profile);
    },
    loadTemplate(profile) {
      if (!profile.template) {
        this.activeTemplate = '';
        return;
      }
      const url = chrome.runtime.getURL(`../templates/${profile.template}`);
      fetch(url)
        .then(response => response.text())
        .then(template => (this.activeTemplate = template));
    },
    create() {
      this.$refs.profileNameEditor.create(this.profiles);
    },
    cancel() {
      this.loadProfiles();
      this.editing = false;
    },
    saveProfiles: function() {
      chrome.storage.sync.set({
        profiles: this.profiles,
      });
    },
    save: function() {
      console.log(this.activeProfile);
      console.log(this.profiles);
      if (this.activeProfile.new) {
        //save
      }
    },
    created(name) {
      const profile = {
        name: name,
        locators: [],
        active: true,
        inbuilt: false,
        template: '',
        new: true,
      };
      this.profiles.push(profile);
      this.activateProfile(profile);
      this.editing = true;
    },
  },
  mounted() {
    this.loadProfiles();
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
