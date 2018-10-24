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

const getElementNodeName = element => {
  const name = element.nodeName.toLowerCase();
  if (element.ownerDocument.contentType === 'application/xhtml+xml') {
    // "x:" prefix is required for XHTML pages
    return `x:${name}`;
  }
  return name;
};

const getSameSiblingCount = element => {
  let childNodes = element.parentNode.childNodes;
  let total = 0;
  for (let i = 0; i < childNodes.length; i++) {
    let child = childNodes[i];
    if (child.nodeName === element.nodeName) {
      total++;
    }
  }
  return total - 1;
};

const getIndexOfElement = element => {
  let childNodes = element.parentNode.childNodes;
  let total = 0;
  let index = -1;
  for (let i = 0; i < childNodes.length; i++) {
    let child = childNodes[i];
    if (child.nodeName === element.nodeName) {
      if (child === element) {
        index = total;
      }
      total++;
    }
  }
  return index;
};

const getRelativeXPathFromParent = element => {
  let index = getIndexOfElement(element);
  let sameSiblingCount = getSameSiblingCount(element);
  let currentPath = '/' + getElementNodeName(element);
  if (index > 0 || sameSiblingCount > 0) {
    currentPath += '[' + (index + 1) + ']';
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
    let text = element.textContent;
    if (!text.match(/^\s*$/)) {
      return uniqueXPath(element, `//${getElementNodeName(element)}[contains(text(),'${text.replace(/^\s+/, '').replace(/\s+$/, '')}')]`);
    }
  }
  return false;
};

const imageBuilder = element => {
  if (element.nodeName === 'IMG') {
    if (element.alt !== '') {
      return uniqueXPath(element, `//${getElementNodeName(element)}[@alt=${attributeValue(element.alt)}]`);
    } else if (element.title !== '') {
      return uniqueXPath(element, `//${getElementNodeName(element)}[@title=${attributeValue(element.title)}]`);
    } else if (element.src !== '') {
      return uniqueXPath(element, `//${getElementNodeName(element)}[@src=${attributeValue(element.src)}]`);
    }
  }
  return false;
};

const absoluteXPathBuilder = element => ({
  xpath: dom.getXPath(element),
});

const builders = [idBuilder, nameBuilder, ariaLabelBuilder, linkTextBuilder, imageBuilder];

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
      if (1 === current.parentNode.nodeType) {
        const preferredParentXPath = getPreferredXPath(current.parentNode);
        if (preferredParentXPath) {
          return uniqueXPath(current.parentNode, `${preferredParentXPath}${path}`);
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
  // final fallback to absolute xpath
  return absoluteXPathBuilder(element);
};
export default getXPath;
