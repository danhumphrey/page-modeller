import lowerFirst from 'lodash/lowerFirst';
import profiles from '../profiles/profiles';

const activateProfile = profileName => {
  const activeProfile = profiles.find(p => p.active);
  if (activeProfile) {
    if (activeProfile.name === profileName) {
      return;
    }
    activeProfile.active = false;
  }
  // make profile active and persist to storage sync
  profiles.find(p => p.name === profileName).active = true;
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

const sendMessage = function(msgType, data) {
  chrome.runtime.sendMessage({ type: msgType, data });
};

const sendMessageToActiveTab = function(msgType, data = {}) {
  chrome.tabs.query(
    {
      currentWindow: true,
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
  console.log('background message: ');
  console.dir(msg);

  switch (msg.type) {
    case 'showOptions':
      chrome.runtime.openOptionsPage();
      return;
    case 'activateProfile':
      activateProfile(msg.data.profileName);
      return;
    case 'generateModel':
      console.log(profiles.find(p => p.active).template(msg.data.model));
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
      console.log(`Message received: '${msg.type}'`);
  }
});
