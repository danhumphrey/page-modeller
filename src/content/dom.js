import Simmer from 'simmerjs';

const getStyle = function(element, style) {
  return element.ownerDocument.defaultView.getComputedStyle(element, null)[style];
};
const isVisible = function(element) {
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

const getTagName = function(element) {
  return element.tagName;
};

const getTagType = function(element) {
  return element.type;
};

const getTagIndex = function(element) {
  const n = getTagName(element);
  const all = element.ownerDocument.getElementsByTagName(n);
  for (let i = 0; i < all.length; i += 1) {
    if (element === all[i]) {
      return i + 1;
    }
  }
  return null;
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

const getElementTreeXPath = function(element, strict) {
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

const getXPath = function(element) {
  if (element && element.id) {
    return `//*[@id="${element.id.trim()}"]`;
  }
  return getElementTreeXPath(element);
};

const getLabel = function(element) {
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

const findElementsByXPath = function(document, locator) {
  const results = [];
  const query = document.evaluate(locator, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  for (let i = 0, length = query.snapshotLength; i < length; i += 1) {
    results.push(query.snapshotItem(i));
  }
  return results;
};

const findElementsByCssSelector = function(document, locator) {
  try {
    return document.querySelectorAll(locator);
  } catch (e) {
    return [];
  }
};

const findElementsByName = function(document, locator) {
  return document.getElementsByName(locator);
};

const findElementsByTagName = function(document, locator) {
  return document.getElementsByTagName(locator);
};

const findElementsByClassName = function(document, locator) {
  return findElementsByCssSelector(document, `.${locator}`);
};

const findElementsById = function(document, locator) {
  return findElementsByCssSelector(document, `#${locator}`);
};

const findElementsByLinkText = function(document, locator) {
  const els = Array.prototype.slice.call(findElementsByTagName(document, 'A'));

  return els.filter(el => {
    const c = el.textContent.replace(/\xA0/g, ' ').replace(/^\s*(.*?)\s*$/, '$1');
    return c === locator;
  });
};
const findElementsByTagIndex = function(document, locator) {
  const matches = /(.*)(\d+)$/.exec(locator);
  const els = Array.prototype.slice.call(findElementsByTagName(document, matches[1]));
  return [els[parseInt(matches[2], 10) - 1]];
};

const findElementsByPartialLinkText = function(document, locator) {
  const els = Array.prototype.slice.call(findElementsByTagName(document, 'A'));

  return els.filter(el => el.textContent.indexOf(locator) !== -1);
};

if (!Element.prototype.scrollIntoViewIfNeeded) {
  Element.prototype.scrollIntoViewIfNeeded = function(centerIfNeeded) {
    function makeRange(start, length) {
      return { start, length, end: start + length };
    }

    function coverRange(inner, outer) {
      if (centerIfNeeded === false || (outer.start < inner.end && inner.start < outer.end)) {
        return Math.max(inner.end - outer.length, Math.min(outer.start, inner.start));
      }
      return (inner.start + inner.end - outer.length) / 2;
    }

    function makePoint(x, y) {
      return {
        x,
        y,
        translate: function translate(dX, dY) {
          return makePoint(x + dX, y + dY);
        },
      };
    }

    function absolute(element, parent) {
      let currentElement = element;
      let pt = parent;
      while (currentElement) {
        pt = pt.translate(element.offsetLeft, element.offsetTop);
        currentElement = currentElement.offsetParent;
      }
      return pt;
    }

    let target = absolute(this, makePoint(0, 0));

    const extent = makePoint(this.offsetWidth, this.offsetHeight);

    let elem = this.parentNode;

    while (elem instanceof HTMLElement) {
      // Apply desired scroll amount.
      const origin = absolute(elem, makePoint(elem.clientLeft, elem.clientTop));
      elem.scrollLeft = coverRange(makeRange(target.x - origin.x, extent.x), makeRange(elem.scrollLeft, elem.clientWidth));
      elem.scrollTop = coverRange(makeRange(target.y - origin.y, extent.y), makeRange(elem.scrollTop, elem.clientHeight));

      // Determine actual scroll amount by reading back scroll properties.
      target = target.translate(-elem.scrollLeft, -elem.scrollTop);
      elem = elem.parentNode;
    }
  };
}

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
