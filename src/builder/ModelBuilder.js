import Model from './Model';
import ModelEntity from './ModelEntity';

const getTagName = function(element) {
  return element.tagName;
};

const getTagIndex = function(element) {
  let n = getTagName(element);
  let all = this.document.getElementsByTagName(n);
  for (let i = 0; i < all.length; i++) {
    if (element === all[i]) {
      return i;
    }
  }
};

export default class ModelBuilder {
  constructor(document) {
    this.document = document;
  }

  createModel(element) {
    const model = new Model(element);

    const tagName = getTagName.bind(this)(element);
    const tagIndex = getTagIndex.bind(this)(element);

    const entity = new ModelEntity(tagName + tagIndex, element, [
      {
        tagName: tagName,
        tagIndex: tagIndex,
      },
    ]);

    model.addEntity(entity);
    return model;
  }
}
