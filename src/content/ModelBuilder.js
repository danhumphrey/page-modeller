import generateName from './elementNamingPipeline';

import dom from './dom';
import getXPath from './xpath';

import profiles from '../profiles/profiles';

const INTERACTIVE_ELEMENTS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

export default class ModelBuilder {
  deDupeName(name) {
    let returnName = name;

    if (name in this.model.usedNames) {
      this.model.usedNames[name] += 1;
      returnName = `${name}${this.model.usedNames[name]}`;
    } else {
      this.model.usedNames[name] = 1;
    }
    return returnName;
  }

  static createEmptyModel() {
    return {
      usedNames: {},
      entities: [],
    };
  }

  createModel({ element, activeProfile, appOptions, existingModel = null }) {
    this.model = existingModel || ModelBuilder.createEmptyModel();
    this.activeProfile = activeProfile;
    if (existingModel) {
      this.model.entities.push(this.createEntity(element));
      return this.model;
    }

    const walker = element.ownerDocument.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (dom.isVisible(node) || appOptions.modelHiddenElements) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT; // node and children
        },
      },
      true
    );
    while (walker.nextNode()) {
      const childElement = walker.currentNode;
      if (INTERACTIVE_ELEMENTS.includes(childElement.tagName)) {
        this.model.entities.push(this.createEntity(childElement));
      }
    }
    return this.model.entities.length === 0 ? null : this.model;
  }

  createEntity(element) {
    return {
      name: this.deDupeName(generateName(element)),
      locators: this.getLocators(element),
      tagName: dom.getTagName(element),
      type: dom.getTagType(element),
    };
  }

  generateLinkTextLocator(element, partial = false) {
    const newLineRegex = /(\r\n|\r|\n)/;
    const linkText = dom.getLinkText(element);
    if (!linkText) {
      return null;
    }
    const newLineMatches = linkText.match(newLineRegex);
    if (newLineMatches) {
      // handle links containing new lines
      console.log(newLineMatches);
      if (partial) {
        return linkText.split(newLineRegex)[0];
      }
      return null;
    }
    return linkText;
  }

  getLocators(element) {
    const tagName = dom.getTagName(element);
    const tagIndex = dom.getTagIndex(element);

    const possibleLocators = [
      {
        name: 'id',
        locator: dom.getId(element),
      },
      {
        name: 'linkText',
        locator: this.generateLinkTextLocator(element),
      },
      {
        name: 'partialLinkText',
        locator: this.generateLinkTextLocator(element, true),
      },
      {
        name: 'name',
        locator: dom.getName(element),
      },
      {
        name: 'css',
        locator: dom.getCssSelector(element),
      },
      {
        name: 'xpath',
        locator: getXPath(element),
      },
      {
        name: 'className',
        locator: dom.getClassName(element),
      },
      {
        name: 'tagName',
        locator: tagName,
      },
      {
        name: 'tagIndex',
        locator: `${tagName}${tagIndex}`,
        selected: true,
        always: true,
        hidden: true,
      },
    ];
    const profile = profiles.find(p => p.name === this.activeProfile);

    const locators = [];
    possibleLocators.forEach(l => {
      if (profile.locators.includes(l.name) || l.always) {
        locators.push(l);
      }
    });

    for (let selectedLocator = locators[locators.length - 1], currentLocator, i = 0; i < locators.length; i += 1) {
      currentLocator = locators[i];
      if (currentLocator.locator) {
        delete selectedLocator.selected;
        currentLocator.selected = true;
        break;
      }
    }

    return locators;
  }
}
