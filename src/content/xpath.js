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
    s;
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

// builder methods
const idBuilder = element => {
  const id = dom.getId(element);
  if (id) {
    return {
      xpath: uniqueXPath(element, `//${getElementNodeName(element)}[@id=${attributeValue(id)}]`),
    };
  }
  return false;
};

const nameBuilder = element => {
  const name = dom.getName(element);
  if (name) {
    return {
      xpath: uniqueXPath(element, `//${getElementNodeName(element)}[@name=${attributeValue(name)}]`),
    };
  }
  return false;
};

const absoluteXPathBuilder = element => ({
  xpath: dom.getXPath(element),
});

const builders = [idBuilder, nameBuilder];
builders.push(absoluteXPathBuilder);

const getXPath = element => {
  let ret;
  for (let i = 0, j = builders.length; i < j; i += 1) {
    const builder = builders[i];
    const output = builder(element);
    if (output) {
      ret = output.xpath;
      break;
    }
  }
  return ret;
};

export default getXPath;
