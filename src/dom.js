const getStyle = function(element, style) {
  return element.ownerDocument.defaultView.getComputedStyle(element, null)[style];
};
const isVisible = function(element) {
  const w = element.offsetWidth;
  const h = element.offsetHeight;
  const force = element.tagName === 'TR';

  return w === 0 && h === 0 && !force ? false : w !== 0 && h !== 0 && !force ? true : getStyle(element, 'display') !== 'none';
};

export default {
  getStyle: getStyle,
  isVisible: isVisible,
};
