const builder = function(el) {
  const getName = function() {
    return el.tagName + "Name";
  };

  return {
    build: function() {
      return {
        name: getName()
      };
    }
  };
};

module.exports = builder;
