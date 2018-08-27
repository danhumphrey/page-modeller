export default class ModelEntity {
  name = null;
  locators = null;

  constructor(name, locators) {
    this.name = name;
    this.locators = locators;
  }
  get name() {
    return this.name;
  }
  get locators() {
    return this.locators;
  }
}
