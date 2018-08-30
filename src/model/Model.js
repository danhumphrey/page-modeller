export default class Model {
  entities = [];

  constructor(model = null) {
    if (model) {
      this.entities = model.entities;
    }
  }
  addEntity(entity) {
    this.entities.push(entity);
  }
  removeEntity(entity) {
    const i = this.entities.indexOf(entity);
    if (i !== -1) {
      this.entities.splice(i, 1);
    }
  }
  hasEntity(tagName, tagIndex) {
    for (const entity of this.entities) {
      let l = entity.locators;
      if (l.tagName === tagName && l.tagIndex === tagIndex) {
        return true;
      }
    }
    return false;
  }
  hasNamedEntity(name) {
    return this.entities.some(e => e.name === name);
  }
}
