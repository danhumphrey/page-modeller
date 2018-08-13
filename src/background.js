import inspector from './inspector';

chrome.runtime.onMessage.addListener(msg => {
  console.log('background.js onMessage: ');

  if (msg.type === 'startInspectingClick') {
    console.log('stopInspectingClick message received');
    chrome.tabs.query(
      {
        currentWindow: true,
        active: true,
      },
      function(tabs) {
        for (let tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'notifyStartInspecting' });
        }
      }
    );
    //inspector.start();
  }

  if (msg.type === 'stopInspectingClick') {
    console.log('stopInspectingClick message received');
    chrome.tabs.query(
      {
        currentWindow: true,
        active: true,
      },
      function(tabs) {
        for (let tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'notifyStopInspecting' });
        }
      }
    );
  }

  return true;
});
