import scrollIntoView from 'scroll-into-view-if-needed';
import inspector from './inspector';
import './content.scss';
import dom from './dom';
import colours from '../styles/colours.scss';
import locatorMatches from './locatorMatches';

const bg = colours.highlightBg;
const bo = colours.highlightBorder;
const styleString = `border: ${bo} solid 2px !important; background-color: ${bg} !important; background: ${bg} !important;`;
let styleTimeout = null;

const removeStyle = el => {
  const style = el.getAttribute('style');
  el.setAttribute('style', style.replace(styleString, ''));
  el.classList.remove('page-modeller-highlight');
};

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'startScanning') {
    inspector.start({ profile: msg.data.profile, options: msg.data.options });
    return;
  }

  if (msg.type === 'startAdding') {
    inspector.start({ model: msg.data.model || null, profile: msg.data.profile, options: msg.data.options });
    return;
  }

  if (msg.type === 'stopInspecting') {
    inspector.stop();
    return;
  }

  if (msg.type === 'showMatches') {
    const { locator } = msg.data;

    console.log(`showMatches for ${locator}`);

    // remove existing matches
    clearTimeout(styleTimeout);
    [...dom.findElementsByClassName(document, 'page-modeller-highlight')].forEach(el => {
      removeStyle(el);
    });
    const matches = locatorMatches(locator);

    if (matches.length === 0) {
      chrome.runtime.sendMessage({ type: 'contentPopupError', data: { message: `0 elements match that locator` } });
      return;
    }
    if (matches.length === 1) {
      chrome.runtime.sendMessage({ type: 'contentPopupSuccess', data: { message: `1 element matches that locator` } });
    }
    if (matches.length > 1) {
      chrome.runtime.sendMessage({ type: 'contentPopupWarning', data: { message: `${matches.length} elements match that locator` } });
    }

    scrollIntoView(matches[0], { behavior: 'smooth', scrollMode: 'if-needed' });

    matches.forEach(el => {
      el.classList.add('page-modeller-highlight');
      el.setAttribute('style', styleString);
      styleTimeout = setTimeout(() => {
        removeStyle(el);
      }, 3000);
    });
  }
});
