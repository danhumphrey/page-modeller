import Util from './util';
import ModelBuilder from './builder';

module.exports = {
  onMouseOver: evt => {
    evt.target.classList.add('page-modeller-hover');
  },
  onMouseOut: evt => {
    evt.target.classList.remove('page-modeller-hover');
  },
  onClick: evt => {
    evt.preventDefault();
    evt.stopPropagation();
    var el = evt.target;
    el.classList.remove('page-modeller-hover');
    module.exports.stop();
    let b = new ModelBuilder(document, el);
    Util.sendMessage('notifyElementInspected', { model: b.build() });
    return false;
  },
  start: function() {
    document.addEventListener('mouseover', this.onMouseOver, true);
    document.addEventListener('mouseout', this.onMouseOut, true);
    document.addEventListener('click', this.onClick, true);
  },
  stop: function() {
    document.removeEventListener('mouseover', this.onMouseOver, true);
    document.removeEventListener('mouseout', this.onMouseOut, true);
    document.removeEventListener('click', this.onClick, true);
  },
};
