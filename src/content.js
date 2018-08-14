import inspector from './inspector';
import './content.scss';

chrome.runtime.onMessage.addListener(msg => {
  console.log('content.js onMessage: ');
  console.dir(msg);

  if (msg.type === 'notifyStartInspecting') {
    console.log('notifyStartInspecting message received');
    inspector.start();
  }

  if (msg.type === 'notifyStopInspecting') {
    console.log('notifyStopInspecting message received');
    inspector.stop();
  }
});
