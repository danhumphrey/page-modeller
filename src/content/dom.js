import Simmer from 'simmerjs';

const getSameSiblingCount = element => {
  const { childNodes } = element.parentNode;
  let total = 0;
  for (let i = 0; i < childNodes.length; i += 1) {
    const child = childNodes[i];
    if (child.nodeName === element.nodeName) {
      total += 1;
    }
  }
  return total - 1;
};

const getIndexOfElement = element => {
  const { childNodes } = element.parentNode;
  let total = 0;
  let index = -1;
  for (let i = 0; i < childNodes.length; i += 1) {
    const child = childNodes[i];
    if (child.nodeName === element.nodeName) {
      if (child === element) {
        index = total;
      }
      total += 1;
    }
  }
  return index;
};

const getElementCoordinates = element => ({
  x: element.getBoundingClientRect().left + element.offsetWidth / 2,
  y: element.getBoundingClientRect().top + element.offsetHeight / 2,
});

const isElementOffScreen = element => {
  const elemCenter = getElementCoordinates(element);
  if (elemCenter.x < 0) return true;
  if (elemCenter.x > (document.documentElement.clientWidth || window.innerWidth)) return true;
  if (elemCenter.y < 0) return true;
  if (elemCenter.y > (document.documentElement.clientHeight || window.innerHeight)) return true;
  return false;
};

const isElementHidden = element => {
  let coords = getElementCoordinates(element);

  /* Stash current Window Scroll */
  const scrollX = window.pageXOffset;
  const scrollY = window.pageYOffset;

  /* Scroll to element */
  window.scrollTo(coords.x, coords.y);

  coords = getElementCoordinates(element);

  let hidden = true;
  const elementsAtPoint = document.elementsFromPoint(coords.x, coords.y);
  elementsAtPoint.some(e => {
    if (e === element) {
      hidden = false;
      return true;
    }
    return false;
  });
  /* revert to the previous scroll location */
  window.scrollTo(scrollX, scrollY);
  return hidden;
};

const isVisible = element => {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility !== 'visible') return false;
  if (style.opacity < 0.1) return false;
  if (element.offsetWidth + element.offsetHeight + element.getBoundingClientRect().height + element.getBoundingClientRect().width === 0) {
    return false;
  }

  if (element.offsetHeight > 0 && isElementHidden(element)) {
    return false;
  }
  return true;
};

const getTagName = element => element.tagName;

const getTagType = element => element.type || null;

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
    return getTextContent(element);
  }
  return null;
};

const getCssSelector = element => {
  const simmer = new Simmer(element.ownerDocument);
  const ret = simmer(element);
  if (ret === false) {
    return null;
  }
  return ret;
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

const getNgBinding = element => {
  if (!window.angular || !element.classList.contains('ng-binding')) {
    return null;
  }
  const dataBinding = window.angular.element(element).data('$binding');
  if (dataBinding) {
    return dataBinding.exp || dataBinding[0].exp || dataBinding;
  }
  return null;
};

const getNgModel = element => {
  const prefixes = ['ng-', 'ng_', 'data-ng-', 'x-ng-', 'ng:'];
  for (let p = 0; p < prefixes.length; p += 1) {
    const model = element.getAttribute(`${prefixes[p]}model`);
    if (model) {
      return model;
    }
  }
  return null;
};

const findElementsByXPath = (document, locator) => {
  const results = [];
  try {
    const query = document.evaluate(locator, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0, length = query.snapshotLength; i < length; i += 1) {
      results.push(query.snapshotItem(i));
    }
    return results;
  } catch (e) {
    return [];
  }
};

const findElementsByCssSelector = (document, locator) => {
  try {
    return [...document.querySelectorAll(locator)];
  } catch (e) {
    return [];
  }
};

const findElementsByName = (document, locator) => [...document.getElementsByName(locator)];

const findElementsByTagName = (document, locator) => [...document.getElementsByTagName(locator)];

const findElementsByClassName = (document, locator) => [...document.getElementsByClassName(locator)];

const findElementsById = (document, locator) => findElementsByCssSelector(document, `[id='${locator}']`);

const findElementsByLinkText = (document, locator) => {
  const els = findElementsByTagName(document, 'A');

  return els.filter(el => {
    const c = el.textContent.replace(/\xA0/g, ' ').replace(/^\s*(.*?)\s*$/, '$1');
    return c === locator;
  });
};
const findElementsByTagIndex = (document, locator) => {
  const matches = /(.*)(\d+)$/.exec(locator);
  try {
    const els = findElementsByTagName(document, matches[1]);
    if (els.length) {
      return [els[parseInt(matches[2], 10) - 1]];
    }
  } catch (e) {
    return [];
  }
  return [];
};

const findElementsByPartialLinkText = (document, locator) => {
  const els = findElementsByTagName(document, 'A');
  return els.filter(el => el.textContent.indexOf(locator) !== -1);
};

const findElementsByNgBinding = (document, locator) => {
  const matches = [];
  if (!window.angular) {
    return matches;
  }
  const bindings = document.getElementsByClassName('ng-binding');
  for (let i = 0; i < bindings.length; i += 1) {
    const binding = getNgBinding(bindings[i]);
    if (binding && binding.indexOf(locator) !== -1) {
      matches.push(bindings[i]);
    }
  }
  return matches;
};

const findElementsByNgModel = (document, model) => {
  const prefixes = ['ng-', 'ng_', 'data-ng-', 'x-ng-', 'ng:'];
  for (let p = 0; p < prefixes.length; p += 1) {
    const selector = `[${prefixes[p]}model="${model}"]`;
    const elements = document.querySelectorAll(selector);
    if (elements.length) {
      return [...elements];
    }
  }
  return [];
};

const IGNORE_ELEMENT_VISIBILITY = ['THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'];

export default {
  isElementHidden,
  isElementOffScreen,
  isVisible,
  getSameSiblingCount,
  getIndexOfElement,
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
  getNgBinding,
  getNgModel,
  findElementsById,
  findElementsByName,
  findElementsByLinkText,
  findElementsByPartialLinkText,
  findElementsByClassName,
  findElementsByTagName,
  findElementsByCssSelector,
  findElementsByXPath,
  findElementsByTagIndex,
  findElementsByNgBinding,
  findElementsByNgModel,
  IGNORE_ELEMENT_VISIBILITY,
};
