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

const transformLocator = locator => {
  if (locator.includes(' > p-radiobutton')) {
    return locator.replace(' > p-radiobutton', ' .p-radiobutton-box');
  }
  // if (locator.includes(' > p-dropdownitem')) {
  //   return locator.replace(' > p-dropdownitem', ' .p-dropdown-item');
  // }
  // if (locator.includes(' > p-dropdown')) {
  //   return locator.replace(' > p-dropdown', ' .p-dropdown');
  // }
  return locator;
}

const renderFindByLocatorStatement = locator => `getDriver().findElement(By.${transformLocatorName(locator.name)}("${transformLocator(locator.locator)}"));`;

const renderGetElementMethod = entity => {
  let output = `
 public WebElement get${entity.name}Element() {
     return ${renderFindByLocatorStatement(entity.locators.find(l => l.selected))}
 }
`;
  if (entity.tagName === 'SELECT' || entity.tagName === 'P-DROPDOWN') {
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

// Method for p-checkbox and p-radiobutton
const renderGetAndSetPCheckboxRadio = entity => `
public boolean get${entity.name}() {
    WebElement el = get${entity.name}Element().findElement(By.xpath(".//div[@class='p-hidden-accessible']/input"));
    return "true".equals(el.getAttribute("aria-checked"));
}

public void set${entity.name}(boolean onOrOff) {
    WebElement el = get${entity.name}Element().findElement(By.xpath(".//div[@class='p-hidden-accessible']/input"));
    boolean isSelected = "true".equals(el.getAttribute("aria-checked"));
    if ((onOrOff && !isSelected) || (!onOrOff && isSelected)) {
        el.click();
    }
}
`;

// Method for p-dropdown
const renderGetAndSetPDropdown = entity => `
public String get${entity.name}Text() {
    WebElement selectedOption = get${entity.name}Element().findElement(By.xpath(".//span[@class='p-dropdown-label']"));
    return selectedOption.getText();
}

public void set${entity.name}ByText(String text) {
    WebElement dropdown = get${entity.name}Element();
    dropdown.findElement(By.xpath(".//div[@role='button']")).click(); // Open the dropdown
    List<WebElement> options = dropdown.findElements(By.cssSelector("ul[role='listbox'] p-dropdownitem > li"));
    for (WebElement option : options) {
        if (text.equals(option.getText())) {
            option.click();
            return;
        }
    }
}
`;

const renderGetAndSetMethods = entity => {
  if (isClickable(entity)) {
    return '';
  }
  if (['P-CHECKBOX', 'P-RADIOBUTTON'].includes(entity.tagName)) {
    return renderGetAndSetPCheckboxRadio(entity);
  }
  
  if (entity.tagName === 'P-DROPDOWN') {
    return renderGetAndSetPDropdown(entity);
  }

  if (entity.tagName === 'P-RADIOBUTTON') {
    return renderGetAndSetCheckboxRadio(entity);
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
  if (entity.tagName === 'SELECT' || entity.tagName === 'P-DROPDOWN') {
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
