import ModelBuilder from './ModelBuilder';
import dom from './dom';
import colours from '../styles/colours.scss';

let currentStyle = '';
const CLASS_NAME = 'page-modeller-hover';
let existingModel = null;
let activeProfile = null;
let appOptions = {};

const onMouseOver = evt => {
  currentStyle = evt.target.getAttribute('style');
  evt.target.classList.add(CLASS_NAME);
  evt.target.setAttribute(
    'style',
    `${currentStyle}; border: ${colours.inspectorBorder} solid 2px !important; background-color: ${colours.inspectorBg} !important; background: ${colours.inspectorBg} !important;`
  );
};
const onMouseOut = evt => {
  evt.target.setAttribute('style', currentStyle);
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
  onMouseOut(evt);

  const element = evt.target;
  const tagName = dom.getTagName(element);
  const tagIndex = dom.getTagIndex(element);

  if (existingModel && existingModel.entities.find(entity => undefined !== entity.locators.find(l => l.name === 'tagIndex' && l.locator === `${tagName}${tagIndex}`))) {
    chrome.runtime.sendMessage({ type: 'contentPopupError', data: { message: 'That element already exists in the model' } });
    return false;
  }

  // eslint-disable-next-line no-use-before-define
  stop();
  const b = new ModelBuilder();
  chrome.runtime.sendMessage({ type: 'contentElementInspected', data: { model: b.createModel({ element, activeProfile, appOptions, existingModel }) } });
  return false;
};

const start = ({ model = null, profile, options }) => {
  console.log('inspector:start');
  existingModel = model;
  activeProfile = profile;
  appOptions = options;

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
