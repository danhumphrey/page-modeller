import Simmer from 'simmerjs';

const getStyle = function(element, style) {
  return element.ownerDocument.defaultView.getComputedStyle(element, null)[style];
};
const isVisible = function(element) {
  const w = element.offsetWidth;
  const h = element.offsetHeight;
  const force = element.tagName === 'TR';

  return w === 0 && h === 0 && !force ? false : w !== 0 && h !== 0 && !force ? true : getStyle(element, 'display') !== 'none';
};

const getTagName = function(element) {
  return element.tagName;
};

const getTagIndex = function(element) {
  let n = getTagName(element);
  let all = element.ownerDocument.getElementsByTagName(n);
  for (let i = 0; i < all.length; i++) {
    if (element === all[i]) {
      return i + 1;
    }
  }
};
const getId = function(element) {
  if (element.id) {
    return element.id.trim();
  }
  return null;
};

const getName = function(element) {
  if (element.name) {
    return element.name.trim();
  }
  return null;
};

const getTextContent = function(element) {
  if (element.textContent) {
    return element.textContent.trim();
  }
  return null;
};

const getClassName = function(element) {
  if (element.className) {
    return element.className.match(/\S+/g)[0];
  }
  return null;
};
const getLinkText = function(element) {
  if (element.nodeName === 'A') {
    if (element.textContent) {
      return element.textContent;
    }
  }
  return null;
};

const getCssSelector = function(element) {
  const simmer = new Simmer(element.ownerDocument);
  return simmer(element);
};

const getXPath = function(element) {
  if (element && element.id) {
    return `//*[@id="${element.id.trim()}"]`;
  }
  return getElementTreeXPath(element);
};

const getElementTreeXPath = function(element, strict) {
  let paths = [];

  for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
    let index = 0;
    for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
      if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) {
        continue;
      }

      if (sibling.nodeName === element.nodeName) {
        ++index;
      }
    }

    const tagName = element.nodeName.toLowerCase();
    const pathIndex = strict || index ? `[${index + 1}]` : '';
    paths.splice(0, 0, tagName + pathIndex);
  }

  return paths.length ? '/' + paths.join('/') : null;
};

export default {
  getStyle: getStyle,
  isVisible: isVisible,
  getTagName: getTagName,
  getTagIndex: getTagIndex,
  getTextContent: getTextContent,
  getId: getId,
  getName: getName,
  getClassName: getClassName,
  getCssSelector: getCssSelector,
  getLinkText: getLinkText,
  getXPath: getXPath,
};
