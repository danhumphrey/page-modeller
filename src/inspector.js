import builder from './builder/ModelBuilder';

const className = 'page-modeller-hover';

const onMouseOver = evt => {
  evt.target.classList.add(className);
};
const onMouseOut = evt => {
  evt.target.classList.remove(className);
};
const onClick = evt => {
  evt.preventDefault();
  evt.stopPropagation();
  let el = evt.target;
  el.classList.remove(className);
  stop();
  let b = new builder(document);
  chrome.runtime.sendMessage({ type: 'contentElementInspected', data: { model: b.createModel(el) } });
  return false;
};

let start = () => {
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
};

let stop = () => {
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onClick, true);
};
export default {
  start: start,
  stop: stop,
};
