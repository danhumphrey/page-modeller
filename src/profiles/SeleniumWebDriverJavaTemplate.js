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

const renderFindByLocatorStatement = locator => `driver.findElement(By.${transformLocatorName(locator.name)}("${locator.locator}"));`;

const renderGetElementMethod = entity => {
  let output = `
 public WebElement get${entity.name}Element() {
     return ${renderFindByLocatorStatement(entity.locators.find(l => l.selected))}
 }
`;
  if (entity.tagName === 'SELECT') {
    output += `
 public Select get${entity.name}Select() {
     return new Select(get${entity.name}Element());
 }
`;
  }
  return output;
};

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return ` 
 public void click${entity.name}() {
     get${entity.name}Element().click();
 }
 `;
  }
  return '';
};

const renderGetAndSetCheckboxRadio = entity => `
 public boolean get${entity.name}() {
     return get${entity.name}Element().isSelected();
 }
 
 public void set${entity.name}(boolean onOrOff) {
     WebElement el = get${entity.name}Element();
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
     return get${entity.name}Element().getAttribute("value");
 }
 
 public void set${entity.name}(String value) {
     get${entity.name}Element().sendKeys(value);
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
     return get${entity.name}Element().getText();
 }
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElementMethod(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
