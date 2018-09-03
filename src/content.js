import inspector from './panel/inspector';
import './content.scss';

chrome.runtime.onMessage.addListener(msg => {
  console.log('content message: ');
  console.dir(msg);

  if (msg.type === 'startScanning') {
    inspector.start();
  }

  if (msg.type === 'startAdding') {
    inspector.start(msg.data.model || null);
  }

  if (msg.type === 'stopInspecting') {
    inspector.stop();
  }
});
