module.exports = {
  sendMessage: function(msgType, data) {
    if (chrome && chrome.runtime) {
      chrome.runtime.sendMessage({ type: msgType, obj: data });
    }
  }
};