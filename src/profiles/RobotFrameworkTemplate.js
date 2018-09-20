import { isClickable, isInteractive } from './templates-helpers';

const renderKeywordsComment = () => `
*** Keywords ***`;

const renderLocator = entity => {
  const locator = entity.locators.find(l => l.selected);
  return `${locator.name}=${locator.locator.replace(/"/g, "'")}`;
};

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return ` 
Click ${entity.name}
    [Documentation]  Click on the ${entity.name} ${entity.tagName} element
    Click  element  ${renderLocator(entity)}  
`;
  }
  return '';
};

export default model => renderKeywordsComment() + model.entities.map(entity => `${renderClickMethod(entity)}`).join('');
