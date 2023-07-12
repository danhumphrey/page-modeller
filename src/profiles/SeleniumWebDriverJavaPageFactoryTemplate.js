import { isClickable, isInteractive } from './templates-helpers';

const renderEntityComment = entity => `
/*
 * ${entity.name}
 * ***************************************************************
 */
`;

const transformLocatorName = locatorName => {
  if (locatorName === 'css') {
    return 'cssSelector';
  }
  return locatorName;
};

const renderFindByLocatorStatement = locator => `@FindBy(By.${transformLocatorName(locator.name)}("${locator.locator}"))`;

const renderGetElementMethod = entity => {
  let output = `
 ${renderFindByLocatorStatement(entity.locators.find(l => l.selected))}
 public WebElement ${entity.name}Element
 `;
  if (entity.tagName === 'SELECT') {
    output += `
 public Select get${entity.name}Select() {
     return new Select(${entity.name}Element);
 }
`;
  }
  return output;
};

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return ` 
 public void click${entity.name}() {
     ${entity.name}Element.click();
 }
 `;
  }
  return '';
};

const renderGetAndSetCheckboxRadio = entity => `
 public boolean get${entity.name}() {
     return ${entity.name}Element.isSelected();
 }
 
 public void set${entity.name}(boolean onOrOff) {
     WebElement el = ${entity.name}Element;
     if( (onOrOff && !el.isSelected()) || (!onOrOff && el.isSelected())) {
         el.click(); 
     }
 }`;

const renderGetAndSetSelect = entity => `
 public String get${entity.name}Text() {
     return get${entity.name}Select().getFirstSelectedOption().getText();
 }
 public String get${entity.name}Value() {
     return get${entity.name}Select().getFirstSelectedOption().getAttribute("value");
 }
 public void set${entity.name}ByValue(String value) {
     get${entity.name}Select().selectByValue(value);
 }
 
 public void set${entity.name}ByText(String text) {
     get${entity.name}Select().selectByVisibleText(text);
 }
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
 public String get${entity.name}() {
     return ${entity.name}Element.getAttribute("value");
 }
 
 public void set${entity.name}(String value) {
     ${entity.name}Element.sendKeys(value);
 }
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
 public String get${entity.name}() {
     return ${entity.name}Element.getText();
 }
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElementMethod(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
