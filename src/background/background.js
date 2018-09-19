import lowerFirst from 'lodash/lowerFirst';
import templates from '../templates/templates';

const profiles = [
  {
    name: 'Selenium WebDriver Java',
    locators: ['ID', 'Link Text', 'Partial Link Text', 'Name', 'CSS', 'XPath', 'Class Name'],
    active: true,
    inbuilt: true,
  },
];

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
    case 'generateModel':
      const activeProfile = profiles.find(p => p.active);
      const templateName = `${activeProfile.name
        .toLowerCase()
        .split(' ')
        .join('')}`;
      console.log(templates[templateName](msg.data.model));
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
