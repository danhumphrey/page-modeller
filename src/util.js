module.exports = {
  sendMessage: function(msgType, data) {
    chrome.runtime.sendMessage({ type: msgType, data: data });
  },
};
