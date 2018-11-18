import lowerFirst from 'lodash/lowerFirst';
import profiles from '../profiles/profiles';

let activeProfile = null;

const activateProfile = profileName => {
  activeProfile = profiles.find(p => p.active);
  if (activeProfile) {
    if (activeProfile.name === profileName) {
      return;
    }
    activeProfile.active = false;
  }
  // make activeProfile active and persist to storage sync
  activeProfile = profiles.find(p => p.name === profileName);
  activeProfile.active = true;
  chrome.storage.sync.set({ activeProfileName: profileName }, () => {});
};

chrome.runtime.onInstalled.addListener(details => {
  const thisVersion = chrome.runtime.getManifest().version;
  if (details.reason === 'install') {
    console.log(`First install of version ${thisVersion}`);
  } else if (details.reason === 'update') {
    console.log(`Updated from ${details.previousVersion} to ${thisVersion}!`);
  }
});

const sendMessage = (msgType, data) => {
  chrome.runtime.sendMessage({ type: msgType, data });
};

const sendMessageToActiveTab = (msgType, data = {}) => {
  chrome.tabs.query(
    {
      active: true,
    },
    tabs => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: msgType, data });
      });
    }
  );
};

chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case 'showOptions':
      chrome.runtime.openOptionsPage();
      return;
    case 'activateProfile':
      activateProfile(msg.data.profileName);
      return;
    case 'saveOptions':
      chrome.storage.sync.set({ options: msg.data.options }, () => {
        sendMessage('optionsUpdated', {});
      });
      return;
    case 'generateModel':
      chrome.storage.sync.get('activeProfileName', result => {
        // get the active activeProfile from storage sync or activate the first activeProfile as default
        if (result && result.activeProfileName) {
          activeProfile = profiles.find(p => p.name === result.activeProfileName);
          activeProfile.active = true;
        } else {
          [activeProfile] = profiles;
        }
        const code = activeProfile.template(msg.data.model);
        sendMessage('showCode', { code });
      });
      return;
    default:
  }

  // relay messages between the app and content script <- ->
  const matches = /^(app|content)(.*)$/.exec(msg.type);

  const msgType = lowerFirst(matches[2]);
  switch (matches[1]) {
    case 'app':
      sendMessageToActiveTab(msgType, msg.data);
      break;
    case 'content':
      sendMessage(msgType, msg.data);
      break;
    default:
  }
});
