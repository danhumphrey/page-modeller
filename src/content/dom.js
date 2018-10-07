import Simmer from 'simmerjs';

const isVisible = element => {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility !== 'visible') return false;
  if (style.opacity < 0.1) return false;
  if (element.offsetWidth + element.offsetHeight + element.getBoundingClientRect().height + element.getBoundingClientRect().width === 0) {
    return false;
  }
  const elemCenter = {
    x: element.getBoundingClientRect().left + element.offsetWidth / 2,
    y: element.getBoundingClientRect().top + element.offsetHeight / 2,
  };
  if (elemCenter.x < 0) return false;
  if (elemCenter.x > (document.documentElement.clientWidth || window.innerWidth)) return false;
  if (elemCenter.y < 0) return false;
  if (elemCenter.y > (document.documentElement.clientHeight || window.innerHeight)) return false;
  let pointContainer = document.elementFromPoint(elemCenter.x, elemCenter.y);
  while (pointContainer !== null) {
    if (pointContainer === element) {
      return true;
    }
    pointContainer = pointContainer.parentNode;
  }
  return false;
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
