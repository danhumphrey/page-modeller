import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import dom from './dom';

const MAX_NAME_LENGTH = 25;

const customLocatorRule = (element, appOptions) => {
  let customAttrName = '';
  if (appOptions.customLocator && appOptions.useCustomLocatorVal) {
      customAttrName = element.getAttribute(appOptions.customLocator);
  }
  return customAttrName || false;
}

const labelNameRule = (element) => {
  const tagName = dom.getTagName(element);

  if (!['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'PROGRESS', 'METER', 'OUTPUT'].includes(tagName)) {
    return false;
  }

  const label = dom.getLabel(element);
  const labelName = label ? label.textContent.trim() : '';
  return labelName || false;
};

const buttonValueRule = (element) => {
  const tagName = dom.getTagName(element);
  if (tagName === 'BUTTON' || ['submit', 'reset'].includes(element.type)) {
    const val = element.value.trim();
    return val || false;
  }
  return false;
};

const placeholderRule = (element) => {
  const placeholder = element.getAttribute('placeholder');
  return placeholder || false;
};

const nameAttributeRule = (element) => {
  const name = dom.getName(element);
  return name || false;
};

const idAttributeRule = (element) => {
  const id = dom.getId(element);
  return id || false;
};

const ariaLabelRule = (element) => {
  const label = element.getAttribute('aria-label');
  return label || false;
};

const ngModelRule = (element) => {
  const model = dom.getNgModel(element);
  return model || false;
};

const ngBindingRule = (element) => {
  const binding = dom.getNgBinding(element);
  return binding || false;
};

const textContentRule = (element) => {
  const newLineRegex = /(\r\n|\r|\n)/;
  let textContent = dom.getTextContent(element);
  if (!textContent) {
    return false;
  }
  const newLineMatches = textContent.match(newLineRegex);
  if (newLineMatches) {
    [textContent] = textContent.split(newLineRegex);
  }
  return textContent || false;
};

const uniqueClassNameRule = (element) => {
  const className = dom.getUniqueClassName(element);
  return className || false;
};

const specialElementTypeRule = (element) => {
  const tagName = dom.getTagName(element);
  if (tagName === 'INPUT' && ['password', 'email', 'tel', 'url', 'search', 'color', 'date', 'month', 'week', 'time'].includes(element.type)) {
    return `${element.type}Element`;
  }
  return false;
};

const defaultNameRule = (element) => {
  const tagName = dom.getTagName(element);
  const tagIndex = dom.getTagIndex(element);
  return `${tagName}${tagIndex}`;
};

const limitNameLength = (name) => name.substring(0, MAX_NAME_LENGTH);

const replaceNumbers = (name) => {
  const ret = name;
  const matches = ret.substr(0, 1).match(/^[0-9]/g);
  if (matches == null) {
    return ret;
  }
  if (ret.length > 1) {
    return `Element${ret}`;
  }
  const replacements = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
  };
  return ret.replace(matches[0], replacements[matches[0]]);
};

const replaceSymbols = (name) => {
  let ret = name;
  // eslint-disable-next-line no-useless-escape
  const matches = name.match(/[-!$%^&*()+|~=`{}\[\]:";'<>?,.\/\\]/g);
  if (matches === null) {
    return name;
  }
  const replacements = {
    '-': 'dash',
    '!': 'exclamation',
    $: 'dollar',
    '%': 'percent',
    '^': 'caret',
    '&': 'ampersand',
    '*': 'asterisk',
    '(': 'lBracket',
    ')': 'rBracket',
    '+': 'plus',
    '|': 'pipe',
    '~': 'tilde',
    '=': 'equals',
    '`': 'backtick',
    '{': 'lbrace',
    '}': 'rbrace',
    '[': 'lSquareBracket',
    ']': 'rSquareBracket',
    ':': 'colon',
    '"': 'quote',
    ';': 'semicolon',
    "'": 'singleQuote',
    '<': 'lt',
    '>': 'gt',
    '?': 'questionMark',
    ',': 'comma',
    '.': 'dot',
    '/': 'forwardSlash',
    '\\': 'backSlash',
  };
  // if single character replace symbol with word replacement
  if (ret.length === 1) {
    return ret.replace(matches[0], replacements[matches[0]]);
  }
  // replace all symbols
  matches.forEach((m) => {
    ret = ret.split(m).join('');
  });
  return ret;
};

const cleanName = (name) => {
  let theName = name.replace(/\s/g, '');
  theName = replaceNumbers(theName);
  theName = replaceSymbols(theName);
  theName = theName.replace(/[^\w]+$/, '');

  if (!theName.match(/^\w+$/)) {
    return false;
  }

  return theName;
};

const formatName = (name) => {
  const theName = camelCase(name) || name; // accommodate for weird bug which results in empty string for single character!
  return upperFirst(limitNameLength(theName));
};

const rules = [
  customLocatorRule,
  labelNameRule,
  placeholderRule,
  buttonValueRule,
  nameAttributeRule,
  idAttributeRule,
  ariaLabelRule,
  ngModelRule,
  ngBindingRule,
  textContentRule,
  uniqueClassNameRule,
  specialElementTypeRule,
];
rules.push(defaultNameRule);

const generateName = (element, appOptions) => {
  let theName;
  for (let i = 0, j = rules.length; i < j; i += 1) {
    const rule = rules[i];
    if (rule.name === 'customLocatorRule') {
      theName = rule(element, appOptions);  
    } else {
      theName = rule(element);
    }
    if (theName) {
      const cleanedName = cleanName(theName);
      if (cleanedName !== false) {
        return formatName(cleanedName);
      }
    }
  }
  return formatName(defaultNameRule(element));
};

export default generateName;
