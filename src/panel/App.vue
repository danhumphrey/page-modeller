<template>
  <v-app>
    <Toolbar @scan="scan" @add="add" @deleteModel="deleteModel" @generateModel="generateModel" :is-inspecting="isInspecting" :is-adding="isAdding" :is-scanning="isScanning" :has-model="hasModel" :currentProfile="currentProfile"/>
    <Table  :model="model" :is-inspecting="isInspecting" />
    <Alert ref="alert"></Alert>
    <Popup ref="popup"></Popup>
    <Confirm ref="confirm"></Confirm>
    <ProfileEditor ref="profileEditor"></ProfileEditor>
  </v-app>
</template>

<script>
import Alert from '../components/Alert';
import Toolbar from './Toolbar';
import Table from './Table';
import ModelBuilder from './ModelBuilder';
import Popup from '../components/Popup';
import Confirm from '../components/Confirm';
import ProfileEditor from '../components/ProfileEditor';

export default {
  name: 'app',
  components: { ProfileEditor, Table, Toolbar, Alert, Popup, Confirm },
  computed: {
    isInspecting: function() {
      return this.isAdding || this.isScanning;
    },
    hasModel: function() {
      return this.model !== null;
    },
  },
  data: function() {
    return {
      isScanning: false,
      isAdding: false,
      model: null,
      currentProfile: null,
    };
  },
  methods: {
    scan: function() {
      this.$data.isScanning = !this.$data.isScanning;

      if (this.isScanning) {
        chrome.runtime.sendMessage({ type: 'appStartScanning', data: {} });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
    add: function() {
      this.$data.isAdding = !this.$data.isAdding;

      if (this.isAdding) {
        chrome.runtime.sendMessage({ type: 'appStartAdding', data: { model: this.$data.model === null ? ModelBuilder.createEmptyModel() : this.$data.model } });
      } else {
        chrome.runtime.sendMessage({ type: 'appStopInspecting', data: {} });
      }
    },
    deleteModel: function() {
      this.$refs.confirm.open('Delete Model', `Really delete the model?`).then(confirm => {
        if (confirm) {
          this.$data.model = null;
        }
      });
    },
    generateModel: function() {
      console.log('Generate Model:');
      console.dir(this.$data.model);
    },
  },
  mounted: function() {
    this.$root.$confirm = this.$refs.confirm.open;
    this.$root.$alert = this.$refs.alert.open;
    this.$root.$popupInfo = this.$refs.popup.info;
    this.$root.$popupError = this.$refs.popup.error;
    this.$root.$popupWarning = this.$refs.popup.warning;
    this.$root.$popupSuccess = this.$refs.popup.success;
    this.$root.$profileEditor = this.$refs.profileEditor;

    //force selection of a modelling profile
    if (this.currentProfile === null) {
      this.$root.$profileEditor.show(true);
    }

    this.$nextTick(function() {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg.type === 'alertMessage') {
          this.$root.$alert(msg.data.title || 'Page Modeller', msg.data.message);
        }

        if (msg.type === 'popupInfo') {
          this.$root.$popupInfo(msg.data.message);
        }

        if (msg.type === 'popupError') {
          this.$root.$popupError(msg.data.message);
        }

        if (msg.type === 'popupWarning') {
          this.$root.$popupWarning(msg.data.message);
        }

        if (msg.type === 'popupSuccess') {
          this.$root.$popupSuccess(msg.data.message);
        }

        if (msg.type === 'elementInspected') {
          console.log('elementInspected message received');
          console.log(msg.data.model);

          this.$data.model = msg.data.model;

          if (this.$data.isAdding) {
            setTimeout(() => (document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight), 100);
          }
          this.$data.isScanning = false;
          this.$data.isAdding = false;
        }
      });
    });
  },
};
</script>
<style scoped lang="scss">
</style>
