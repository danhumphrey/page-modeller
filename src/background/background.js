import lowerFirst from 'lodash/lowerFirst';

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    console.log('This is the first install!');
  } else if (details.reason === 'update') {
    const thisVersion = chrome.runtime.getManifest().version;
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

  if (msg.type === 'showOptions') {
    chrome.runtime.openOptionsPage();
    return;
  }

  // relay messages between the app and content script <- ->
  const m = /^(app|content)(.*)$/.exec(msg.type);

  const msgType = lowerFirst(m[2]);
  switch (m[1]) {
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
