const isClickable = (entity) => {
  return  ['A', 'BUTTON', 'IMG'].includes(entity.tagName) || (entity.tagName === 'INPUT' && ['button', 'reset', 'image', 'submit'].includes(entity.type));
};
const isInteractive = (entity) => {
  return ['INPUT', 'A', 'BUTTON', 'IMG', 'SELECT', 'TEXTAREA'].includes(entity.tagName);
};
const renderEntityComment = (entity) => {
  return`
/*
 * ${entity.name}
 * ***************************************************************
 */
`;
};
const renderFindByLocatorStatement = (locator) => {
  if(!locator.selected) {
    return '';
  }
  const locatorName = locator.name === 'css' ? 'cssSelector' : locator.name;
  return `driver.findElement(By.${locatorName}("${locator.locator}"));`;
};
const renderGetElementMethod = (entity) => {
  return `
 public WebElement get${entity.name}Element() {
     ${entity.locators.map(locator => renderFindByLocatorStatement(locator)).join('')}
 }
`;
};
const renderClickMethod = (entity) => {
  if(isClickable(entity)) {
    return` 
 public void click${entity.name}() {
     get${entity.name}Element().click();
 }`
  } else {
    return '';
  }
};

const renderGetTextMethod = (entity) => {
  if(isInteractive(entity)) {
    return '';
  }
  return` 
 public String get${entity.name}() {
     get${entity.name}Element().getText();
 }`
};

const seleniumwebdriverjava = (model) => {
  return model.entities.map( entity => `${renderEntityComment(entity)}${renderGetElementMethod(entity)}${renderClickMethod(entity)}${renderGetTextMethod(entity)}`).join('');
};

export default {
  seleniumwebdriverjava
}