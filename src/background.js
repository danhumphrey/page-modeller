import util from './util';

chrome.runtime.onMessage.addListener(msg => {
  console.log('background.js onMessage: ');

  if (msg.type === 'uiStartInspecting') {
    console.log('uiStartInspecting message received');
    util.sendMessageToActiveTab('notifyStartInspecting');
  }

  if (msg.type === 'uiStopInspecting') {
    console.log('uiStopInspecting message received');
    util.sendMessageToActiveTab('notifyStopInspecting');
  }
});
