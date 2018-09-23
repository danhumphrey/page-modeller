import ModelBuilder from './ModelBuilder';
import dom from './dom';

const CLASS_NAME = 'page-modeller-hover';
let existingModel = null;
let activeProfile = null;

const onMouseOver = evt => {
  evt.target.classList.add(CLASS_NAME);
};
const onMouseOut = evt => {
  evt.target.classList.remove(CLASS_NAME);
};
const onFocus = evt => {
  evt.preventDefault();
  evt.stopPropagation();
  const el = evt.target;
  el.blur();
};
const onClick = evt => {
  evt.preventDefault();
  evt.stopPropagation();
  const element = evt.target;
  element.classList.remove(CLASS_NAME);

  const tagName = dom.getTagName(element);
  const tagIndex = dom.getTagIndex(element);

  if (existingModel && existingModel.entities.find(entity => undefined !== entity.locators.find(l => l.name === 'tagIndex' && l.locator === `${tagName}${tagIndex}`))) {
    chrome.runtime.sendMessage({ type: 'contentAlertMessage', data: { title: 'Add Element', message: 'That element already exists in the model' } });
    return false;
  }

  // eslint-disable-next-line no-use-before-define
  stop();

  const b = new ModelBuilder();
  chrome.runtime.sendMessage({ type: 'contentElementInspected', data: { model: b.createModel({ element, activeProfile, existingModel }) } });
  return false;
};

const start = ({ currentModel = null, profile }) => {
  console.log('start inspecting');
  existingModel = currentModel;
  activeProfile = profile;

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('focus', onFocus, true);
};

const stop = () => {
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('mouseout', onMouseOut, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('focus', onFocus, true);
};

export default {
  start,
  stop,
};
