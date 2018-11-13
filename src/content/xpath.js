import dom from './dom';

const attributeValue = value => {
  let val = value;
  if (val.indexOf("'") < 0) {
    return `'${val}'`;
  }
  if (val.indexOf('"') < 0) {
    return `"${val}"`;
  }
  let result = 'concat(';
  let part = '';
  let didReachEndOfValue = false;
  while (!didReachEndOfValue) {
    const apos = val.indexOf("'");
    const quot = val.indexOf('"');
    if (apos < 0) {
      result += `'${val}'`;
      didReachEndOfValue = true;
      break;
    } else if (quot < 0) {
      result += `"${val}"`;
      didReachEndOfValue = true;
      break;
    } else if (quot < apos) {
      part = val.substring(0, apos);
      result += `'${part}'`;
      val = val.substring(part.length);
    } else {
      part = val.substring(0, quot);
      result += `"${part}"`;
      val = val.substring(part.length);
    }
    result += ',';
  }
  result += ')';
  return result;
};

const uniqueXPath = (element, xpath) => {
  const matchingElements = [...dom.findElementsByXPath(element.ownerDocument, xpath)];
  if (matchingElements.length === 1 && matchingElements[0] === element) {
    return xpath;
  }
  for (let i = 0; i < matchingElements.length; i += 1) {
    const newXPath = `(${xpath})[${i + 1}]`;
    if ([...dom.findElementsByXPath(element.ownerDocument, newXPath)][0] === element) {
      return newXPath;
    }
  }
  return xpath;
};

const isXhtmlDocument = doc => {
  if (doc.doctype.publicId.includes('XHTML') || doc.contentType === 'application/xhtml+xml') {
    return true;
  }
  return false;
};
const getElementNodeName = element => {
  const name = element.nodeName.toLowerCase();
  if (isXhtmlDocument(element.ownerDocument)) {
    // "x:" prefix is required for XHTML pages
    return `x:${name}`;
  }
  return name;
};

const getRelativeXPathFromParent = element => {
  const index = dom.getIndexOfElement(element);
  const sameSiblingCount = dom.getSameSiblingCount(element);
  let currentPath = `/${getElementNodeName(element)}`;
  if (index > 0 || sameSiblingCount > 0) {
    currentPath += `[${index + 1}]`;
  }
  return currentPath;
};

// builder methods
const idBuilder = element => {
  const id = dom.getId(element);
  if (id) {
    return uniqueXPath(element, `//${getElementNodeName(element)}[@id=${attributeValue(id)}]`);
  }
  return false;
};

const ngModelBuilder = element => {
  const prefixes = ['ng-', 'ng_', 'data-ng-', 'x-ng-', `ng:`];
  for (let i = 0, j = prefixes.length; i < j; i += 1) {
    const attr = `${prefixes[i]}model`;
    const model = element.getAttribute(attr);
    if (model) {
      return uniqueXPath(element, `//${element.nodeName.toLowerCase()}[@${attr}=${attributeValue(model)}]`);
    }
  }
  return false;
};

const nameBuilder = element => {
  const name = dom.getName(element);
  if (name) {
    return uniqueXPath(element, `//${getElementNodeName(element)}[@name=${attributeValue(name)}]`);
  }
  return false;
};

const ariaLabelBuilder = element => {
  const label = element.getAttribute('aria-label');
  if (label) {
    return uniqueXPath(element, `//${getElementNodeName(element)}[@aria-label=${attributeValue(label)}]`);
  }
  return false;
};

const linkTextBuilder = element => {
  if (element.nodeName === 'A') {
    const text = element.textContent.trim();
    if (!text.match(/^\s*$/)) {
      return uniqueXPath(element, `//${getElementNodeName(element)}[contains(text(),'${text}')]`);
    }
  }
  return false;
};

const linkHrefBuilder = element => {
  if (element.nodeName === 'A') {
    if (element.href !== '') {
      const url = new URL(element.href);
      const path = url.pathname.substr(1, url.pathname.length - 1);
      if (path) {
        return uniqueXPath(element, `//${getElementNodeName(element)}[contains(@href,${attributeValue(path)})]`);
      }
    }
  }
  return false;
};

const buttonTextBuilder = element => {
  if (element.nodeName === 'BUTTON') {
    const text = element.textContent.trim();
    if (!text.match(/^\s*$/)) {
      return uniqueXPath(element, `//${getElementNodeName(element)}[contains(text(),'${text}')]`);
    }
  }
  return false;
};

const inputButtonValueBuilder = element => {
  if (element.nodeName === 'INPUT' && ['button', 'submit'].includes(element.type)) {
    const text = element.value.trim();
    if (!text.match(/^\s*$/)) {
      return uniqueXPath(element, `//${getElementNodeName(element)}[contains(@value,${attributeValue(text)})]`);
    }
  }
  return false;
};

const imageBuilder = element => {
  if (element.nodeName === 'IMG') {
    if (element.alt !== '') {
      return uniqueXPath(element, `//${getElementNodeName(element)}[@alt=${attributeValue(element.alt)}]`);
    }
    if (element.title !== '') {
      return uniqueXPath(element, `//${getElementNodeName(element)}[@title=${attributeValue(element.title)}]`);
    }
    if (element.src !== '') {
      const url = new URL(element.src);
      const path = url.pathname.substr(1, url.pathname.length - 1);
      return uniqueXPath(element, `//${getElementNodeName(element)}[contains(@src,${attributeValue(path)})]`);
    }
  }
  return false;
};

const uniqueClassNameBuilder = element => {
  const uniqueClassName = dom.getUniqueClassName(element);
  if (uniqueClassName) {
    return `//${getElementNodeName(element)}[contains(@class,${attributeValue(uniqueClassName)})]`;
  }
  return false;
};

const getIndexBasedXPath = element => {
  let path = '';
  let current = element;
  while (current != null) {
    let currentPath;
    if (current.parentNode != null) {
      currentPath = getRelativeXPathFromParent(current);
    } else {
      currentPath = `/${getElementNodeName(current.nodeName.toLowerCase())}`;
    }
    path = currentPath + path;
    const locator = `/${path}`;

    const matchingElements = [...dom.findElementsByXPath(element.ownerDocument, locator)];
    if (matchingElements.length === 1 && matchingElements[0] === element) {
      return locator;
    }
    current = current.parentNode;
  }
  return null;
};

const indexedXPathBuilder = element => uniqueXPath(element, getIndexBasedXPath(element));

const builders = [
  idBuilder,
  ngModelBuilder,
  nameBuilder,
  ariaLabelBuilder,
  linkTextBuilder,
  uniqueClassNameBuilder,
  linkHrefBuilder,
  buttonTextBuilder,
  inputButtonValueBuilder,
  imageBuilder,
];

const getPreferredXPath = element => {
  for (let i = 0, j = builders.length; i < j; i += 1) {
    const builder = builders[i];
    const ret = builder(element);
    if (ret) {
      return ret;
    }
  }
  return false;
};

const relativeXPathBuilder = element => {
  let path = '';
  let current = element;
  while (current != null) {
    if (current.parentNode != null) {
      path = getRelativeXPathFromParent(current) + path;
      if (current.parentNode.nodeType === 1) {
        const preferredParentXPath = getPreferredXPath(current.parentNode);
        if (preferredParentXPath) {
          return uniqueXPath(element, `${preferredParentXPath}${path}`);
        }
      }
    } else {
      return false;
    }
    current = current.parentNode;
  }
  return false;
};

const getXPath = element => {
  // regular builders
  let ret = getPreferredXPath(element);
  if (ret) {
    return ret;
  }
  // relative builder
  ret = relativeXPathBuilder(element);
  if (ret) {
    return ret;
  }
  // fallback
  return indexedXPathBuilder(element);
};
export default {
  getIndexBasedXPath,
  getXPath,
};
