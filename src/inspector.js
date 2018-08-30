import ModelBuilder from './ModelBuilder';

const CLASS_NAME = 'page-modeller-hover';
let existingModel = null;

const onMouseOver = evt => {
  evt.target.classList.add(CLASS_NAME);
};
const onMouseOut = evt => {
  evt.target.classList.remove(CLASS_NAME);
};
const onFocus = evt => {
  evt.preventDefault();
  evt.stopPropagation();
  let el = evt.target;
  el.blur();
};
const onClick = evt => {
  evt.preventDefault();
  evt.stopPropagation();
  let el = evt.target;
  el.classList.remove(CLASS_NAME);
  stop();

  let b = new ModelBuilder();
  chrome.runtime.sendMessage({ type: 'contentElementInspected', data: { model: b.createModel(el, existingModel) } });
  return false;
};

let start = (currentModel = null) => {
  existingModel = currentModel;
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('focus', onFocus, true);
};

let stop = () => {
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('focus', onFocus, true);
};
export default {
  start: start,
  stop: stop,
};
