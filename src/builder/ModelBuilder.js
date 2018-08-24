import Model from './Model';
import ModelEntity from './ModelEntity';

const getTagName = function(element) {
  return element.tagName;
};

const getTagIndex = function(element) {
  let n = getTagName(element);
  let all = this.document.getElementsByTagName(n);
  for (let i = 0; i < all.length; i++) {
    if (element === all[i]) {
      return i;
    }
  }
};
const getId = function(element) {
  if (element.id) {
    return element.id;
  }
  return null;
};

const getName = function(element) {
  if (element.name) {
    return element.name;
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
  if (element.nodeName == 'A') {
    var text = element.textContent;
    if (!text.match(/^\s*$/)) {
      return text.replace(/\xA0/g, ' ').replace(/^\s*(.*?)\s*$/, '$1');
    }
  }
  return null;
};

const getCssSelector = function(element) {
  let result = '';
  const parent = element.ownerDocument;
  let stop = false;

  while (element && element !== parent && !stop) {
    let str = '';
    if (element.nodeType === Node.ELEMENT_NODE) {
      if (element.nodeName === 'INPUT' && element.name && (element.type === 'radio' || element.type === 'checkbox')) {
        return "input[name='" + element.name + "'][value='" + element.value + "']";
      }
      if (element.id) {
        str = '#' + element.id;
        stop = true;
      } else if (element.name) {
        str = element.nodeName + "[name='" + element.name + "']";
      } else if (element.nodeName === 'INPUT' && element.value) {
        return "input[value='" + element.value + "']";
      } else if (element.nodeName === 'IMG' && element.alt) {
        return "img[alt='" + element.alt + "']";
      } else if (element.nodeName === 'IMG' && element.title) {
        return "img[title='" + element.title + "']";
      } else if (element.nodeName === 'IMG' && element.src) {
        return "img[src*='" + element.src + "']";
      } else {
        str = element.localName.toLowerCase();
      }

      result = str + (result ? ' > ' + result : '');
    }

    if (element instanceof Attr) {
      element = element.ownerElement;
    } else {
      element = element.parentNode;
    }
  }
  return result;
};
export default class ModelBuilder {
  constructor(document) {
    this.document = document;
  }

  createModel(element) {
    const model = new Model();

    const entity = new ModelEntity('myelement', {
      id: getId.bind(this)(element),
      name: getName.bind(this)(element),
      linkText: getLinkText.bind(this)(element),
      className: getClassName.bind(this)(element),
      tagName: getTagName.bind(this)(element),
      tagIndex: getTagIndex.bind(this)(element),
      css: getCssSelector.bind(this)(element),
    });

    model.addEntity(entity);
    return model;
  }
}
