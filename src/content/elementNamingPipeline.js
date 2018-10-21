import camelCase from 'lodash/camelCase';
import upperFirst from 'lodash/upperFirst';
import dom from './dom';

const MAX_NAME_LENGTH = 25;

const labelNameRule = element => {
  const tagName = dom.getTagName(element);

  if (!['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'PROGRESS', 'METER', 'OUTPUT'].includes(tagName)) {
    return {
      handled: false,
    };
  }

  const label = dom.getLabel(element);
  const labelName = label ? label.textContent.trim() : '';

  if (labelName) {
    return {
      name: labelName,
      handled: true,
    };
  }

  return {
    handled: false,
  };
};

const buttonValueRule = element => {
  const tagName = dom.getTagName(element);
  if (tagName === 'BUTTON' || ['submit', 'reset'].includes(element.type)) {
    const val = element.value.trim();
    if (val) {
      return {
        name: val,
        handled: true,
      };
    }
  }

  return {
    handled: false,
  };
};

const nameAttributeRule = element => {
  const name = dom.getName(element);
  if (name) {
    return {
      name,
      handled: true,
    };
  }

  return {
    handled: false,
  };
};

const idAttributeRule = element => {
  const id = dom.getId(element);
  if (id) {
    return {
      name: id,
      handled: true,
    };
  }

  return {
    handled: false,
  };
};

const textContentRule = element => {
  const textContent = dom.getTextContent(element);
  if (textContent) {
    return {
      name: textContent,
      handled: true,
    };
  }

  return {
    handled: false,
  };
};

const specialElementTypeRule = element => {
  const tagName = dom.getTagName(element);
  if (tagName === 'INPUT' && ['password', 'email', 'tel', 'url', 'search', 'color', 'date', 'month', 'week', 'time'].includes(element.type)) {
    return {
      name: `${element.type}Element`,
      handled: true,
    };
  }

  return {
    handled: false,
  };
};

const defaultNameRule = element => {
  const tagName = dom.getTagName(element);
  const tagIndex = dom.getTagIndex(element);

  return {
    name: `${tagName}${tagIndex}`,
    handled: true,
  };
};

const limitNameLength = name => name.substring(0, MAX_NAME_LENGTH);

const replaceNumbers = name => {
  const ret = name;
  const matches = ret.substr(0, 1).match(/^[0-9]/g);
  if (matches == null) {
    return ret;
  }
  if (ret.length > 1) {
    return `Element${ret}`;
  }
  const replacements = {
    '0': 'zero',
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
    '6': 'six',
    '7': 'seven',
    '8': 'eight',
    '9': 'nine',
  };
  return ret.replace(matches[0], replacements[matches[0]]);
};

const replaceSymbols = name => {
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
  matches.forEach(m => {
    ret = ret.split(m).join('');
  });
  return ret;
};

const cleanName = (name, element) => {
  let ret = name.replace(/\s/g, '');
  ret = replaceNumbers(ret);
  ret = replaceSymbols(ret);

  if (!ret.match(/^\w+$/)) {
    ret = defaultNameRule(element).name;
  }
  ret = camelCase(ret) || ret; // accommodate for weird bug which results in empty string for single character!
  return upperFirst(limitNameLength(ret));
};

const rules = [labelNameRule, buttonValueRule, nameAttributeRule, idAttributeRule, textContentRule, specialElementTypeRule];
rules.push(defaultNameRule);

const generateName = element => {
  let ret;
  for (let i = 0, j = rules.length; i < j; i += 1) {
    const rule = rules[i];
    const output = rule(element);
    if (output.handled) {
      ret = output.name;
      break;
    }
  }
  return cleanName(ret, element);
};

export default generateName;
