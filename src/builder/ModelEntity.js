class ModelEntity {
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
