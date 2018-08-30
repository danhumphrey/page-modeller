export default class Model {
  entities = [];

  get entities() {
    return this.entities;
  }
  addEntity(entity) {
    this.entities.push(entity);
  }
  removeEntity(entity) {
    var i = this.entities.indexOf(entity);

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
    for (const entity of this.entities) {
      if (entity.name === name) {
        return true;
      }
    }
    return false;
  }
}
