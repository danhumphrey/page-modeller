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
      return element.textContent.trim();
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

const getLabel = function(element) {
  //use 'for' attribute to find label
  const id = getId(element);
  if (id) {
    const label = element.ownerDocument.querySelector(`label[for="${id}"`);
    if (label) {
      return label;
    }
  }
  //iterate parents looking for wrapping label
  let parent = element.parentNode;
  do {
    if (parent.tagName === 'LABEL') {
      return parent;
    }
  } while ((parent = parent.parentNode));
  return null;
};

const findElementByXPath = function(document, locator) {
  return document.evaluate(locator, document, null, FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
};

const findElementsByXPath = function(document, locator) {
  const els = [];
  try {
    const snapshot = document.evaluate(locator, document, null, ORDERED_NODE_SNAPSHOT_TYPE, null);

    if (snapshot && snapshot.snapshotLength) {
      for (let i = 0, j = snapshot.snapshotLength; i < j; i++) {
        els.push(snapshot.snapshotItem(i));
      }
    }
  } catch (e) {}

  return els;
};
const findElementsByCssSelector = function(document, locator) {
  try {
    return document.querySelectorAll(locator);
  } catch (e) {}
};

const findElementsByName = function(document, locator) {
  return document.getElementsByName(locator);
};

const findElementsByTagName = function(document, locator) {
  return document.getElementsByTagName(locator);
};

const findElementsByClassName = function(document, locator) {
  return findElementsByCssSelector(document, '.' + locator);
};

const findElementsById = function(document, locator) {
  return findElementsByCssSelector(document, '#' + locator);
};

const findElementsByLinkText = function(document, locator) {
  var els = Array.prototype.slice.call(findElementsByTagName(document, 'A'));

  return els.filter(function(el) {
    var c = el.textContent.replace(/\xA0/g, ' ').replace(/^\s*(.*?)\s*$/, '$1');
    return c === locator;
  });
};

const findElementsByPartialLinkText = function(document, locator) {
  const els = Array.prototype.slice.call(findElementsByTagName('A'));

  return els.filter(function(el) {
    return el.textContent.indexOf(locator) !== -1;
  });
};

if (!Element.prototype.scrollIntoViewIfNeeded) {
  Element.prototype.scrollIntoViewIfNeeded = function(centerIfNeeded) {
    centerIfNeeded = arguments.length === 0 ? true : !!centerIfNeeded;

    const parent = this.parentNode,
      parentComputedStyle = window.getComputedStyle(parent, null),
      parentBorderTopWidth = parseInt(parentComputedStyle.getPropertyValue('border-top-width')),
      parentBorderLeftWidth = parseInt(parentComputedStyle.getPropertyValue('border-left-width')),
      overTop = this.offsetTop - parent.offsetTop < parent.scrollTop,
      overBottom = this.offsetTop - parent.offsetTop + this.clientHeight - parentBorderTopWidth > parent.scrollTop + parent.clientHeight,
      overLeft = this.offsetLeft - parent.offsetLeft < parent.scrollLeft,
      overRight = this.offsetLeft - parent.offsetLeft + this.clientWidth - parentBorderLeftWidth > parent.scrollLeft + parent.clientWidth,
      alignWithTop = overTop && !overBottom;

    if ((overTop || overBottom) && centerIfNeeded) {
      parent.scrollTop = this.offsetTop - parent.offsetTop - parent.clientHeight / 2 - parentBorderTopWidth + this.clientHeight / 2;
    }

    if ((overLeft || overRight) && centerIfNeeded) {
      parent.scrollLeft = this.offsetLeft - parent.offsetLeft - parent.clientWidth / 2 - parentBorderLeftWidth + this.clientWidth / 2;
    }

    if ((overTop || overBottom || overLeft || overRight) && !centerIfNeeded) {
      this.scrollIntoView(alignWithTop);
    }
  };
}

export default {
  isVisible: isVisible,
  getTagName: getTagName,
  getTagIndex: getTagIndex,
  getTextContent: getTextContent,
  getId: getId,
  getName: getName,
  getClassName: getClassName,
  getCssSelector: getCssSelector,
  getLinkText: getLinkText,
  getLabel: getLabel,
  getXPath: getXPath,
  findElementsById: findElementsById,
  findElementsByName: findElementsByName,
  findElementsByLinkText: findElementsByLinkText,
  findElementsByPartialLinkText: findElementsByPartialLinkText,
  findElementsByClassName: findElementsByClassName,
  findElementsByTagName: findElementsByTagName,
  findElementsByCssSelector: findElementsByCssSelector,
  findElementsByXPath: findElementsByXPath,
};
