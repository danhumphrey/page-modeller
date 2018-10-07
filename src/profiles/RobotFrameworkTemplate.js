import lowerFirst from 'lodash/lowerFirst';
import { isClickable, isInteractive } from './templates-helpers';

let minWidth = 0;

const getMinWidth = entities => {
  const longest = entities.reduce((p, c) => (p.name.length > c.name.length ? p : c));
  return longest.name.length + '  '.length;
};

const nameSpaces = name => ''.padEnd(minWidth - name.length, ' ');

const transformLocatorName = locatorName => {
  switch (locatorName) {
    case 'linkText':
      return 'link';
    case 'tagName':
      return 'tag';
    default:
      return locatorName;
  }
};

const renderLocator = entity => {
  const locator = entity.locators.find(l => l.selected);
  return `${transformLocatorName(locator.name)}=${locator.locator.replace(/"/g, "'")}`;
};

const renderLocatorVariable = entity => `
\${${lowerFirst(entity.name)}}${nameSpaces(entity.name)}${renderLocator(entity)}`;

const renderLocators = entities => {
  minWidth = getMinWidth(entities);
  console.log(minWidth);
  return `
*** Variables ***${entities.map(entity => renderLocatorVariable(entity)).join('')}`;
};

const renderKeywordsComment = () => `

*** Keywords ***`;

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return ` 
Click ${entity.name}
    [Documentation]  Click on the ${entity.name} ${entity.tagName} element
    Click Element  \${${lowerFirst(entity.name)}}  
`;
  }
  return '';
};

const renderGetAndSetCheckboxRadio = entity => `
Set ${entity.name}
    [Documentation]  Set the ${entity.name} ${entity.tagName} element
    Click Element  \${${lowerFirst(entity.name)}}

Get ${entity.name}
    [Documentation]  Returns the state of the ${entity.name} ${entity.tagName} element
    \${${lowerFirst(entity.name)}IsSelected}=  Run Keyword And Return Status  Checkbox Should Be Selected  \${${lowerFirst(entity.name)}}
    [Return]  \${${lowerFirst(entity.name)}IsSelected}
`;

const renderGetAndSetSelect = entity => `
Set ${entity.name}
    [Arguments]  \${${lowerFirst(entity.name)}Value}
    [Documentation]  Set ${entity.name} ${entity.tagName} element by value
    Select From List  \${${lowerFirst(entity.name)}}  \${${lowerFirst(entity.name)}Value}
    
Set ${entity.name} By Label
    [Arguments]  \${${lowerFirst(entity.name)}Label}
    [Documentation]  Set ${entity.name} ${entity.tagName} element by label
    Select From List By Label  \${${lowerFirst(entity.name)}}  \${${lowerFirst(entity.name)}Label}

Get ${entity.name} Value
    [Documentation]  Get ${entity.name} ${entity.tagName} element value
    \${${lowerFirst(entity.name)}Value}=  Get Selected List Value  \${${lowerFirst(entity.name)}}
    [Return]  \${${lowerFirst(entity.name)}Value}

Get ${entity.name} Label
    [Documentation]  Get ${entity.name} ${entity.tagName} element label
    \${${lowerFirst(entity.name)}Label}=  Get Selected List Label  \${${lowerFirst(entity.name)}}
    [Return]  \${${entity.name}Label}    
`;

const renderGetAndSetMethods = entity => {
  if (isClickable(entity)) {
    return '';
  }

  if (['INPUT', 'TEXTAREA'].includes(entity.tagName)) {
    if (['checkbox', 'radio'].includes(entity.type)) {
      return renderGetAndSetCheckboxRadio(entity);
    }
    // regular input
    return `
Get ${entity.name}
    [Documentation]  Get ${entity.name} ${entity.tagName} element value
    \${${lowerFirst(entity.name)}Value}=  Get Value  \${${lowerFirst(entity.name)}}
    [Return]  \${${lowerFirst(entity.name)}Value}
 
Set ${entity.name}
    [Arguments]  \${${lowerFirst(entity.name)}Value}
    [Documentation]  Set ${entity.name} ${entity.tagName} element value
    Input Text  \${${lowerFirst(entity.name)}}  \${${lowerFirst(entity.name)}Value}
`;
  }
  if (entity.tagName === 'SELECT') {
    return renderGetAndSetSelect(entity);
  }
  return '';
};
const renderGetTextMethod = entity => {
  if (isInteractive(entity)) {
    return '';
  }
  return ` 
Get ${entity.name}
    [Documentation]  Get ${entity.name} ${entity.tagName} element value
    \${${lowerFirst(entity.name)}Value}=  Get Text  \${${lowerFirst(entity.name)}}
    [Return]  \${${lowerFirst(entity.name)}Value} 
`;
};
export default model =>
  renderLocators(model.entities) +
  renderKeywordsComment() +
  model.entities.map(entity => `${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`).join('');
