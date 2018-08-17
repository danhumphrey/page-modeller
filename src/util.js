module.exports = {
  lowerCaseFirst: function(s) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  },
  upperCaseFirst: function(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
};
