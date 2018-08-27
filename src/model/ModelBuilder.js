import Model from './Model';
import ModelEntity from './ModelEntity';
import Simmer from 'simmerjs';
import Dom from '../dom';

const INTERACTIVE_ELEMENTS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

const getTagName = function(element) {
  return element.tagName;
};

const getTagIndex = function(element) {
  let n = getTagName(element);
  let all = this.document.getElementsByTagName(n);
  for (let i = 0; i < all.length; i++) {
    if (element === all[i]) {
      return i + 1;
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
  const simmer = new Simmer(element.ownerDocument);
  return simmer(element);
};

const getXPath = function(element) {
  if (element && element.id) {
    return `//*[@id="${element.id}"]`;
  }
  return getElementTreeXPath(element);
};

const getElementTreeXPath = function(element, strict) {
  let paths = [];

  for (; element && element.nodeType == 1; element = element.parentNode) {
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

export default class ModelBuilder {
  constructor(document) {
    this.document = document;
  }

  createModel(element, isAdding) {
    console.log('createModel');

    const model = new Model();
    if (isAdding) {
      model.addEntity(this.createEntity(element));
      return model;
    }

    const walker = this.document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: function(node) {
          if (Dom.isVisible(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT; //node and children
        },
      },
      true
    );
    while (walker.nextNode()) {
      const childElement = walker.currentNode;
      if (INTERACTIVE_ELEMENTS.includes(childElement.tagName)) {
        model.addEntity(this.createEntity(childElement));
      }
    }
    return model;
  }

  createEntity(element) {
    const tagName = getTagName.bind(this)(element);
    const tagIndex = getTagIndex.bind(this)(element);

    return new ModelEntity(`${tagName}${tagIndex}`, {
      id: getId.bind(this)(element),
      name: getName.bind(this)(element),
      linkText: getLinkText.bind(this)(element),
      className: getClassName.bind(this)(element),
      tagName: tagName,
      tagIndex: tagIndex,
      css: getCssSelector.bind(this)(element),
      xpath: getXPath.bind(this)(element),
    });
  }
}
