module.exports = {
  sendMessage: function(msgType, data) {
    chrome.runtime.sendMessage({ type: msgType, data: data });
  },

  sendMessageToActiveTab: function(msgType, data = {}) {
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
  },
};
