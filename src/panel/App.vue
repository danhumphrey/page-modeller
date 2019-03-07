<template>
  <v-app :dark="options.darkMode">
    <Toolbar
      @scan="scan"
      @add="add"
      @deleteModel="deleteModel"
      @generateModel="generateModel"
      @activateProfile="activateProfile"
      :is-inspecting="isInspecting"
      :is-adding="isAdding"
      :is-scanning="isScanning"
      :has-model="hasModel"
      :profile-list="profiles"
      :active-profile="activeProfile"
      :show-tooltips="options.showTooltips"
    />
    <EntityTable ref="table" :model="model" :is-inspecting="isInspecting" :show-tooltips="options.showTooltips" @emptyModel="emptyModel" /> <Alert ref="alert"></Alert>
    <Popup ref="popup" :dark-mode="options.darkMode"></Popup> <Confirm ref="confirm"></Confirm> <CodeDialog ref="code"></CodeDialog>
  </v-app>
</template>

<script>
import Alert from '../components/Alert';
import Toolbar from './Toolbar';
import EntityTable from './Table';
import ModelBuilder from '../content/ModelBuilder';
import Popup from '../components/Popup';
import Confirm from '../components/Confirm';
import profiles from '../profiles/profiles';
import CodeDialog from '../components/CodeDialog';
import defaultOptions from '../options/defaultOptions';

export default {
  name: 'app',
  components: { EntityTable, Toolbar, Alert, Popup, Confirm, CodeDialog },
  computed: {
    isInspecting() {
      return this.isAdding || this.isScanning;
    },
    hasModel() {
      return this.model !== null;
    },
  },
  data() {
    return {
      isScanning: false,
      isAdding: false,
      model: null,
      options: defaultOptions,
      profiles,
      activeProfile: '',
    };
  },
  methods: {
    scan() {
      this.isScanning = !this.isScanning;

      if (this.isScanning) {
        chrome.runtime.sendMessage({ type: 'appStartScanning', data: { profile: this.activeProfile, options: this.options } });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
    add() {
      this.isAdding = !this.isAdding;

      if (this.isAdding) {
        chrome.runtime.sendMessage({
          type: 'appStartAdding',
          data: { model: this.model === null ? ModelBuilder.createEmptyModel() : this.model, profile: this.activeProfile, options: this.options },
        });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
    emptyModel() {
      this.model = null;
    },
    deleteModel() {
      this.$refs.confirm.open('Delete Model', `Really delete the model?`).then(confirm => {
        if (confirm) {
          this.model = null;
        }
      });
    },
    generateModel() {
      chrome.runtime.sendMessage({ type: 'generateModel', data: { model: this.model } });
    },
    activateProfile(profileName) {
      const currentActiveProfile = this.profiles.find(p => p.active);
      if (currentActiveProfile) {
        currentActiveProfile.active = false;
      }
      this.profiles.find(p => p.name === profileName).active = true;
      this.activeProfile = profileName;
      chrome.runtime.sendMessage({ type: 'activateProfile', data: { profileName } });
    },
    loadOptions() {
      chrome.storage.sync.get(['options'], result => {
        if (result) {
          if (result.options) {
            this.options = result.options;
          } else {
            // no options saved, so save defaults
            chrome.runtime.sendMessage({ type: 'saveOptions', data: { options: this.options } });
          }
        }
      });
    },
  },
  mounted() {
    this.$root.$confirm = this.$refs.confirm.open;
    this.$root.$alert = this.$refs.alert.open;
    this.$root.$popupInfo = this.$refs.popup.info;
    this.$root.$popupError = this.$refs.popup.error;
    this.$root.$popupWarning = this.$refs.popup.warning;
    this.$root.$popupSuccess = this.$refs.popup.success;
    this.$root.$profileEditor = this.$refs.profileEditor;
    this.$root.$table = this.$refs.table;
    this.$root.$table.loadOptions();

    chrome.storage.sync.get(['activeProfileName', 'options'], result => {
      if (result) {
        if (result.options) {
          this.options = result.options;
        } else {
          // no options saved, so save defaults
          chrome.runtime.sendMessage({ type: 'saveOptions', data: { options: this.options } });
        }

        // get the active activeProfile from storage sync or activate the first activeProfile as default
        if (result.activeProfileName) {
          this.profiles.find(p => p.name === result.activeProfileName).active = true;
          this.activeProfile = result.activeProfileName;
        } else {
          this.activateProfile(profiles[0].name);
        }
      }
    });

    this.$nextTick(() => {
      chrome.runtime.onMessage.addListener(msg => {
        switch (msg.type) {
          case 'alertMessage':
            this.$root.$alert(msg.data.title || 'Page Modeller', msg.data.message);
            return;
          case 'popupInfo':
            this.$root.$popupInfo(msg.data.message);
            return;
          case 'popupError':
            this.$root.$popupError(msg.data.message);
            return;
          case 'popupWarning':
            this.$root.$popupWarning(msg.data.message);
            return;
          case 'popupSuccess':
            this.$root.$popupSuccess(msg.data.message);
            return;
          case 'elementInspected':
            this.model = msg.data.model;
            if (this.model === null) {
              this.$root.$popupWarning('Cannot determine model - add elements individually.');
            }
            if (this.isAdding) {
              setTimeout(() => {
                document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
              }, 100);
            }
            this.isScanning = false;
            this.isAdding = false;
            return;
          case 'showCode':
            this.$refs.code.show(this.activeProfile, msg.data.code);
            break;
          case 'optionsUpdated':
            this.loadOptions();
            this.$root.$table.loadOptions();
            break;
          default:
        }
      });
    });
  },
};
</script>
