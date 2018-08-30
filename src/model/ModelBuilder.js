import Model from './Model';
import ModelEntity from './ModelEntity';
import modelNameGenerator from './model-name-generator';
import dom from '../dom';

const INTERACTIVE_ELEMENTS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

export default class ModelBuilder {
  createModel(element, existingModel = null) {
    console.log('createModel');
    this.model = new Model(existingModel);

    if (existingModel) {
      this.model.addEntity(this.createEntity(element));
      return this.model;
    }

    const walker = element.ownerDocument.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: function(node) {
          if (dom.isVisible(node)) {
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
        this.model.addEntity(this.createEntity(childElement));
      }
    }
    return this.model;
  }

  createEntity(element) {
    const tagName = dom.getTagName(element);
    const tagIndex = dom.getTagIndex(element);

    return new ModelEntity(modelNameGenerator.generateName(this.model, element), {
      id: dom.getId(element),
      name: dom.getName(element),
      linkText: dom.getLinkText(element),
      className: dom.getClassName(element),
      tagName: tagName,
      tagIndex: tagIndex,
      css: dom.getCssSelector(element),
      xpath: dom.getXPath(element),
    });
  }
}
