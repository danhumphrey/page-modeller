import Model from './Model';

module.exports = function(document, element) {
  const getTagName = function() {
    return element.tagName;
  };

  const getTagIndex = function() {
    let n = getTagName();
    let all = document.getElementsByTagName(n);
    for (let i = 0; i < all.length; i++) {
      if (element === all[i]) {
        return i;
      }
    }
  };
  return {
    build: function(model) {
      if (!model) {
        model = new Model();
      }

      return {
        tagName: getTagName(),
        tagIndex: getTagIndex(),
      };
    },
  };
};
