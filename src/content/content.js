import scrollIntoView from 'scroll-into-view-if-needed';
import inspector from './inspector';
import './content.scss';
import dom from './dom';
import colours from '../styles/colours.scss';

const bg = colours.highlightBg;
const bo = colours.highlightBorder;
const styleString = `border: ${bo} solid 2px !important; background-color: ${bg} !important; background: ${bg} !important;`;
let styleTimeout = null;

const removeStyle = el => {
  const style = el.getAttribute('style');
  el.setAttribute('style', style.replace(`border: ${bo} solid 2px !important; background-color: ${bg} !important; background: ${bg} !important;`, ''));
  el.classList.remove('page-modeller-highlight');
};

chrome.runtime.onMessage.addListener(msg => {
  console.log('content message: ');
  console.dir(msg);

  if (msg.type === 'startScanning') {
    console.log('startScanning');
    inspector.start({ profile: msg.data.profile, options: msg.data.options });
  }

  if (msg.type === 'startAdding') {
    console.log('startAdding');
    inspector.start({ model: msg.data.model || null, profile: msg.data.profile, options: msg.data.options });
  }

  if (msg.type === 'stopInspecting') {
    inspector.stop();
  }

  if (msg.type === 'showMatches') {
    const { locator } = msg.data;

    let matches;

    switch (locator.name) {
      case 'xpath':
        matches = dom.findElementsByXPath(document, locator.locator);
        break;
      case 'css':
        matches = dom.findElementsByCssSelector(document, locator.locator);
        break;
      case 'name':
        matches = dom.findElementsByName(document, locator.locator);
        break;
      case 'tagName':
        matches = dom.findElementsByTagName(document, locator.locator);
        break;
      case 'tagIndex':
        matches = dom.findElementsByTagIndex(document, locator.locator);
        break;
      case 'className':
        matches = dom.findElementsByClassName(document, locator.locator);
        break;
      case 'id':
        matches = dom.findElementsById(document, locator.locator);
        break;
      case 'linkText':
        matches = dom.findElementsByLinkText(document, locator.locator);
        break;
      case 'partialLinkText':
        matches = dom.findElementsByPartialLinkText(document, locator.locator);
        break;
      default:
        console.error(`Unexpected locator ${locator}`);
    }

    matches = [...matches];

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

    // remove existing matches
    clearTimeout(styleTimeout);
    [...dom.findElementsByClassName(document, 'page-modeller-highlight')].forEach(el => {
      removeStyle(el);
    });

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
