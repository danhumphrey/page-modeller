import Simmer from 'simmerjs';

const getStyle = (element, style) => element.ownerDocument.defaultView.getComputedStyle(element, null)[style];

const isVisible = element => {
  const w = element.offsetWidth;
  const h = element.offsetHeight;
  const force = element.tagName === 'TR';

  if (w === 0 && h === 0 && !force) {
    return false;
  }
  if (w !== 0 && h !== 0 && !force) {
    return true;
  }
  return getStyle(element, 'display') !== 'none';
};

const getTagName = element => element.tagName;

const getTagType = element => element.type;

const getTagIndex = element => {
  const n = getTagName(element);
  const all = element.ownerDocument.getElementsByTagName(n);
  for (let i = 0; i < all.length; i += 1) {
    if (element === all[i]) {
      return i + 1;
    }
  }
  return null;
};

const getId = element => {
  if (element.id) {
    return element.id.trim();
  }
  return null;
};

const getName = element => {
  if (element.name) {
    return element.name.trim();
  }
  return null;
};

const getTextContent = element => {
  if (element.textContent) {
    return element.textContent.trim();
  }
  return null;
};

const getClassName = element => {
  if (element.className) {
    return element.className.match(/\S+/g)[0];
  }
  return null;
};

const getLinkText = element => {
  if (element.nodeName === 'A') {
    if (element.textContent) {
      return element.textContent.trim();
    }
  }
  return null;
};

const getCssSelector = element => {
  const simmer = new Simmer(element.ownerDocument);
  return simmer(element);
};

const getElementTreeXPath = (element, strict) => {
  const paths = [];
  let currentElement = element;

  for (; currentElement && currentElement.nodeType === Node.ELEMENT_NODE; currentElement = currentElement.parentNode) {
    let index = 0;
    for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
      if (sibling.nodeType !== Node.DOCUMENT_TYPE_NODE) {
        if (sibling.nodeName === currentElement.nodeName) {
          index += 1;
        }
      }
    }

    const tagName = currentElement.nodeName.toLowerCase();
    const pathIndex = strict || index ? `[${index + 1}]` : '';
    paths.splice(0, 0, tagName + pathIndex);
  }

  return paths.length ? `/${paths.join('/')}` : null;
};

const getXPath = element => {
  if (element && element.id) {
    return `//*[@id="${element.id.trim()}"]`;
  }
  return getElementTreeXPath(element);
};

const getLabel = element => {
  // use 'for' attribute to find label
  const id = getId(element);
  if (id) {
    const label = element.ownerDocument.querySelector(`label[for="${id}"`);
    if (label) {
      return label;
    }
  }
  // iterate parents looking for wrapping label
  let parent = element.parentNode;
  do {
    if (parent.tagName === 'LABEL') {
      return parent;
    }
    parent = parent.parentNode;
  } while (parent);
  return null;
};

const findElementsByXPath = (document, locator) => {
  const results = [];
  const query = document.evaluate(locator, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  for (let i = 0, length = query.snapshotLength; i < length; i += 1) {
    results.push(query.snapshotItem(i));
  }
  return results;
};

const findElementsByCssSelector = (document, locator) => {
  try {
    return document.querySelectorAll(locator);
  } catch (e) {
    return [];
  }
};

const findElementsByName = (document, locator) => document.getElementsByName(locator);

const findElementsByTagName = (document, locator) => document.getElementsByTagName(locator);

const findElementsByClassName = (document, locator) => findElementsByCssSelector(document, `.${locator}`);

const findElementsById = (document, locator) => findElementsByCssSelector(document, `#${locator}`);

const findElementsByLinkText = (document, locator) => {
  const els = Array.prototype.slice.call(findElementsByTagName(document, 'A'));

  return els.filter(el => {
    const c = el.textContent.replace(/\xA0/g, ' ').replace(/^\s*(.*?)\s*$/, '$1');
    return c === locator;
  });
};
const findElementsByTagIndex = (document, locator) => {
  const matches = /(.*)(\d+)$/.exec(locator);
  const els = Array.prototype.slice.call(findElementsByTagName(document, matches[1]));
  return [els[parseInt(matches[2], 10) - 1]];
};

const findElementsByPartialLinkText = (document, locator) => {
  const els = Array.prototype.slice.call(findElementsByTagName(document, 'A'));

  return els.filter(el => el.textContent.indexOf(locator) !== -1);
};

export default {
  isVisible,
  getTagName,
  getTagType,
  getTagIndex,
  getTextContent,
  getId,
  getName,
  getClassName,
  getCssSelector,
  getLinkText,
  getLabel,
  getXPath,
  findElementsById,
  findElementsByName,
  findElementsByLinkText,
  findElementsByPartialLinkText,
  findElementsByClassName,
  findElementsByTagName,
  findElementsByCssSelector,
  findElementsByXPath,
  findElementsByTagIndex,
};
