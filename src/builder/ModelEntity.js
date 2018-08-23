export default class ModelEntity {
  name = null;
  element = null;
  locators = null;

  constructor(name, element, locators) {
    this.name = name;
    this.element = element;
    this.locators = locators;
  }

  get name() {
    return this.name;
  }

  get element() {
    return this.element;
  }

  get locators() {
    return this.locators;
  }
}
