class Model {
  constructor() {
    this.entities = [];
  }

  get entities() {
    return this.entities;
  }

  addEntity(entity) {
    this.entities.push(entity);
  }

  removeEntity(entity) {
    var i = this.entities.indexOf(entity);

    if (i != -1) {
      this.entities.splice(i, 1);
    }
  }
}
