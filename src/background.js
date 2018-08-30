import lowerFirst from 'lodash/lowerFirst';

const sendMessage = function(msgType, data) {
  chrome.runtime.sendMessage({ type: msgType, data: data });
};
const sendMessageToActiveTab = function(msgType, data = {}) {
  chrome.tabs.query(
    {
      currentWindow: true,
      active: true,
    },
    function(tabs) {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: msgType, data: data });
      }
    }
  );
};
chrome.runtime.onMessage.addListener(msg => {
  console.log('background message: ');
  console.dir(msg);

  //relay messages between the app and content script <- ->
  let m = /^(app|content)(.*)$/.exec(msg.type);
  if (m === null) {
    return;
  }
  let msgType = lowerFirst(m[2]);
  switch (m[1]) {
    case 'app':
      sendMessageToActiveTab(msgType, msg.data);
      break;
    case 'content':
      sendMessage(msgType, msg.data);
      break;
  }
});
