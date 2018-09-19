const isClickable = entity => ['A', 'BUTTON', 'IMG'].includes(entity.tagName) || (entity.tagName === 'INPUT' && ['button', 'reset', 'image', 'submit'].includes(entity.type));

const isInteractive = entity => ['INPUT', 'A', 'BUTTON', 'IMG', 'SELECT', 'TEXTAREA'].includes(entity.tagName);

const renderEntityComment = entity => `
/*
 * ${entity.name}
 * ***************************************************************
 */
`;

const renderFindByLocatorStatement = locator => {
  if (!locator.selected) {
    return '';
  }
  const locatorName = locator.name === 'css' ? 'cssSelector' : locator.name;
  return `driver.findElement(By.${locatorName}("${locator.locator}"));`;
};

const renderGetElementMethod = entity => {
  let output = `
 public WebElement get${entity.name}Element() {
     return ${entity.locators.map(locator => renderFindByLocatorStatement(locator)).join('')}
 }
`;
  if (entity.tagName === 'SELECT') {
    output += `
 public Select get${entity.name}Select() {
     return new Select(get${entity.name}Element());
 }
 
 public void set${entity.name}ByValue(String value) {
     return get${entity.name}Select().selectByValue(value);
 }
 
 public void set${entity.name}ByText(String text) {
     return get${entity.name}Select().selectByVisibleText(text);
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
 public String get${entity.name}() {
     return get${entity.name}Select().getFirstSelectedOption().getText();
 }
`;

const renderGetAndSetMethods = entity => {
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
     get${entity.name}Element().getText();
 }
`;
};

const seleniumwebdriverjava = model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElementMethod(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');

export default {
  seleniumwebdriverjava,
};