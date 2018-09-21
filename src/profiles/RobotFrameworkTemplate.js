import { isClickable, isInteractive } from './templates-helpers';

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

const renderLocatorVariable = entity => {
  let output = `
\${${entity.name}}\t${renderLocator(entity)}`;
  if (entity.tagName === 'INPUT') {
    if (['checkbox', 'radio'].includes(entity.type)) {
      output += `
\${${transformLocatorName(entity.name) + 'IsSelected'}}`;
      return output;
    }
  }
  if (!isClickable(entity)) {
    output += `
\${${transformLocatorName(entity.name) + 'Value'}}`;
  }
  return output;
};

const renderLocators = entities => {
  return (
    `
*** Variables ***` + entities.map(entity => renderLocatorVariable(entity)).join('')
  );
};
const renderKeywordsComment = () => `

*** Keywords ***`;

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return ` 
Click ${entity.name}
    [Documentation]  Click on the ${entity.name} ${entity.tagName} element
    Click  Element  \${${entity.name}}  
`;
  }
  return '';
};
const renderGetAndSetCheckboxRadio = entity => `
Set ${entity.name}
    [Documentation]  Set the ${entity.name} ${entity.tagName} element
    Click  Element  \${${entity.name}}

Get ${entity.name}
    [Documentation]  Returns the state of the ${entity.name} ${entity.tagName} element
    \${${entity.name}IsSelected}= Run Keyword And Return Status  Checkbox Should Be Selected  \${${entity.name}}
    [Return]  \${${entity.name}IsSelected}
`;

const renderGetAndSetSelect = entity => `
Set ${entity.name}
    [Arguments]  \${${entity.name}Value}=\${DATA['${entity.name}']}
    [Documentation]  Set ${entity.name} ${entity.tagName} element by value
    Select From List \${${entity.name}}  \${${entity.name}Value}
    
Set ${entity.name} By Label
    [Arguments]  \${${entity.name}Value}=\${DATA['${entity.name}']}
    [Documentation]  Set ${entity.name} ${entity.tagName} element by label
    Select From List By Label  \${${entity.name}}  \${${entity.name}Value}

Get ${entity.name} Value
    [Arguments]  \${${entity.name}Value}=\${DATA['${entity.name}']}
    [Documentation]  Get ${entity.name} ${entity.tagName} element value
    \${${entity.name}Value}=  Get Selected List Value  \${${entity.name}}
    [Return]  \${${entity.name}Value}

Get ${entity.name} Label
    [Arguments]  \${${entity.name}Value}=\${DATA['${entity.name}']}
    [Documentation]  Get ${entity.name} ${entity.tagName} element label
    \${${entity.name}Value}=  Get Selected List Label  \${${entity.name}}
    [Return]  \${${entity.name}Value}    
`;

const renderGetAndSetMethods = entity => {
  if (['INPUT', 'TEXTAREA'].includes(entity.tagName)) {
    if (['checkbox', 'radio'].includes(entity.type)) {
      return renderGetAndSetCheckboxRadio(entity);
    }
    // regular input
    return `
Get ${entity.name}
    [Documentation]  Get ${entity.name} ${entity.tagName} element value
    \${${entity.name}Value}=  Get Value  \${${entity.name}}
    [Return] \${${entity.name}Value}
 
Set ${entity.name}
    [Arguments]  \${${entity.name}Value}=\${DATA['${entity.name}']}
    [Documentation]  Set ${entity.name} ${entity.tagName} element value
    Input Text \${${entity.name}} \${${entity.name}Value}
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
    \${${entity.name}Value}=  Get Text  \${${entity.name}}
    [Return] \${${entity.name}Value} 
`;
};
export default model =>
  renderLocators(model.entities) +
  renderKeywordsComment() +
  model.entities.map(entity => `${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`).join('');
