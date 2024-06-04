import Simmer from 'simmerjs';
import scrollIntoView from 'scroll-into-view-if-needed';

const getSameSiblingCount = (element) => {
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

const getElementIndex = (element) => {
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

const getElementBox = (element) => {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    centreX: rect.left + rect.width / 2,
    centreY: rect.top + rect.height / 2,
  };
};

const getScrollPosition = () => ({
  scrollDownRemaining: document.documentElement.scrollHeight - (window.innerHeight + document.documentElement.scrollTop),
  scrollUpRemaining: document.documentElement.scrollTop,
  scrollLeftRemaining: document.documentElement.scrollLeft,
  scrollRightRemaining: document.documentElement.scrollWidth - (window.innerWidth + document.documentElement.scrollLeft),
});

const isElementOffScreen = (element) => {
  const vpW = document.documentElement.clientWidth || window.innerWidth;
  const vpH = document.documentElement.clientHeight || window.innerHeight;

  const elementBox = getElementBox(element);
  if (elementBox.x < 0 && elementBox.x + elementBox.width < 0) return true;
  if (elementBox.x > vpW) return true;
  if (elementBox.y < 0 && elementBox.y + elementBox.height < 0) return true;
  if (elementBox.y > vpH) return true;
  return false;
};

const isElementHidden = (element) => {
  // stash current window scroll position
  const scrollX = window.pageXOffset;
  const scrollY = window.pageYOffset;

  const vpW = document.documentElement.clientWidth || window.innerWidth;
  const vpH = document.documentElement.clientHeight || window.innerHeight;

  let box = getElementBox(element);

  window.scrollTo(0, 0);
  if (box.x < document.documentElement.scrollWidth && box.y < document.documentElement.scrollHeight) {
    scrollIntoView(element, { behavior: 'instant', scrollMode: 'if-needed' });
  }

  // get position again
  box = getElementBox(element);

  if (isElementOffScreen(element)) {
    window.scrollTo(scrollX, scrollY);
    return true;
  }

  const centreOffScreen = box.centreX < 0 || box.centreY < 0 || box.centreX > vpW || box.centreY > vpH;
  const elementsAtPoint = document.elementsFromPoint(box.centreX, box.centreY);
  if (centreOffScreen || elementsAtPoint.length === 0) {
    window.scrollTo(scrollX, scrollY);
    return false; // iterate children as some may be within viewport
  }

  let hidden = true;
  elementsAtPoint.some((e) => {
    if (e === element) {
      hidden = false;
      return true;
    }
    return false;
  });
  // revert to the previous scroll position
  window.scrollTo(scrollX, scrollY);
  return hidden;
};
const getTagName = (element) => element.tagName;

const getTagType = (element) => element.type || null;

const isVisible = (element) => {
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  if (style.display === 'none') {
    return false;
  }
  if (style.visibility !== 'visible') {
    return false;
  }
  if (style.opacity < 0.1) {
    return false;
  }
  // This is unreliable and prevents some visible child elements from being included:
  // if (element.offsetWidth + element.offsetHeight + element.getBoundingClientRect().height + element.getBoundingClientRect().width === 0) {
  //   return false;
  // }

  if (getTagName(element) === 'INPUT' && getTagType(element) === 'hidden') {
    return false;
  }
  if (element.offsetHeight > 0 && isElementHidden(element)) {
    return false;
  }
  return true;
};

const getTagIndex = (element) => {
  const n = getTagName(element);
  const all = element.ownerDocument.getElementsByTagName(n);
  for (let i = 0; i < all.length; i += 1) {
    if (element === all[i]) {
      return i + 1;
    }
  }
  return null;
};

const getId = (element) => {
  if (element.id) {
    return element.id.trim();
  }
  return null;
};

const getName = (element) => {
  if (element.name && element.name.trim) {
    return element.name.trim();
  }
  return null;
};

const getTextContent = (element) => {
  if (element.textContent) {
    return element.textContent.trim();
  }
  return null;
};

const getClassName = (element) => {
  const classAttribute = element.getAttribute('class');
  if (classAttribute) {
    const matches = classAttribute.match(/\S+/g);
    if (matches && matches.length) {
      return matches[0];
    }
  }
  return null;
};

const getClassNames = (element) => {
  const classes = element.classList;
  if (classes.length === 0) {
    return [];
  }
  return [...classes];
};

const getLinkText = (element) => {
  if (element.nodeName === 'A') {
    return getTextContent(element);
  }
  return null;
};

const getCssSelector = (element) => {
  const simmer = new Simmer(element.ownerDocument);
  const ret = simmer(element);
  if (ret === false) {
    return element.tagName;
  }
  return ret;
};

const getLabel = (element) => {
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

const getNgBinding = (element) => {
  if (!window.angular || !element.classList.contains('ng-binding')) {
    return null;
  }
  const dataBinding = window.angular.element(element).data('$binding');
  if (dataBinding) {
    return dataBinding.exp || dataBinding[0].exp || dataBinding;
  }
  return null;
};

const getNgModel = (element) => {
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

  return els.filter((el) => {
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
  return els.filter((el) => el.textContent.indexOf(locator) !== -1);
};

const findElementsByNgBinding = (document, locator) => {
  const matches = [];
  if (!window.angular || !locator) {
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
  if (!model) {
    return [];
  }
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

const getUniqueClassName = (element) => {
  const classNames = getClassNames(element);
  for (let i = 0, j = classNames.length; i < j; i += 1) {
    const className = classNames[i];
    if (className && findElementsByClassName(element.ownerDocument, className).length === 1) {
      return className;
    }
  }
  return null;
};

const IGNORE_ELEMENT_VISIBILITY = ['THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'];

export default {
  isElementHidden,
  isElementOffScreen,
  isVisible,
  getSameSiblingCount,
  getIndexOfElement: getElementIndex,
  getTagName,
  getTagType,
  getTagIndex,
  getTextContent,
  getId,
  getName,
  getClassName,
  getClassNames,
  getUniqueClassName,
  getCssSelector,
  getLinkText,
  getLabel,
  getNgBinding,
  getNgModel,
  getScrollPosition,
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
