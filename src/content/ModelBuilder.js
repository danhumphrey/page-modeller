import generateName from './elementNamingPipeline';

import dom from './dom';
import getCssSelector from './css';
import xpath from './xpath';
import locatorMatches from './locatorMatches';

import profiles from '../profiles/profiles';

const INTERACTIVE_ELEMENTS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
const generateLinkTextLocator = (element, partial = false) => {
  const newLineRegex = /(\r\n|\r|\n)/;
  const linkText = dom.getLinkText(element);
  if (!linkText) {
    return null;
  }
  const newLineMatches = linkText.match(newLineRegex);
  if (newLineMatches) {
    // handle links containing new lines
    if (partial) {
      return linkText.split(newLineRegex)[0];
    }
    return null;
  }
  return linkText;
};

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
      this.model.entities.push(this.createEntity(element, appOptions));
      return this.model;
    }

    const walker = element.ownerDocument.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          const isVisible = dom.isVisible(node) || dom.IGNORE_ELEMENT_VISIBILITY.includes(node.nodeName);
          if (isVisible || appOptions.modelHiddenElements) {
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
        this.model.entities.push(this.createEntity(childElement, appOptions));
      }
    }
    return this.model.entities.length === 0 ? null : this.model;
  }

  createEntity(element, appOptions) {
    return {
      name: this.deDupeName(generateName(element, appOptions)),
      locators: this.getLocators(element, appOptions),
      tagName: dom.getTagName(element),
      type: dom.getTagType(element),
    };
  }

  getLocators(element, appOptions) {
    const tagName = dom.getTagName(element);
    const tagIndex = dom.getTagIndex(element);

    const possibleLocators = [
      {
        name: 'customLocator',
        locator: dom.getCustomLocator(element, appOptions),
      },
      {
        name: 'id',
        locator: dom.getId(element),
      },
      {
        name: 'linkText',
        locator: generateLinkTextLocator(element),
      },
      {
        name: 'partialLinkText',
        locator: generateLinkTextLocator(element, true),
      },
      {
        name: 'name',
        locator: dom.getName(element),
      },
      {
        name: 'model',
        locator: dom.getNgModel(element),
      },
      {
        name: 'binding',
        locator: dom.getNgBinding(element),
      },
      {
        name: 'css',
        locator: getCssSelector(element),
      },
      {
        name: 'xpath',
        locator: xpath.getXPath(element),
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
        always: true,
        hidden: true,
      },
    ];
    const profile = profiles.find((p) => p.name === this.activeProfile);

    const locators = [];
    possibleLocators.forEach((l) => {
      if (profile.locators.includes(l.name) || l.always) {
        locators.push(l);
      }
    });

    for (let selectedLocator = locators[locators.length - 1], currentLocator, i = 0; i < locators.length; i += 1) {
      currentLocator = locators[i];
      if (!currentLocator.hidden) {
        const matches = locatorMatches(currentLocator);
        if (currentLocator.locator && matches.length === 1) {
          delete selectedLocator.selected;
          currentLocator.selected = true;
          break;
        }
      }
    }

    // force an index based xpath locator if we don't have a better one
    let selectedLocator = locators.find((l) => l.selected === true);
    if (!selectedLocator) {
      selectedLocator = locators.find((l) => l.name === 'xpath');
      selectedLocator.selected = true;
      selectedLocator.locator = xpath.getIndexBasedXPath(element);
    }

    return locators;
  }
}
