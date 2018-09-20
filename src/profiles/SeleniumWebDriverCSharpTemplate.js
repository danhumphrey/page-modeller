import upperFirst from 'lodash/upperFirst';
import { isClickable, isInteractive } from './templates-helpers';

const renderEntityComment = entity => `
/*
 * ${entity.name}
 * ***************************************************************
 */
`;

const transformLocatorName = locatorName => {
  if (locatorName === 'css') {
    return 'CssSelector';
  }
  return upperFirst(locatorName);
};

const renderFindByLocatorStatement = locator => {
  return `driver.FindElement(By.${transformLocatorName(locator.name)}("${locator.locator}"));`;
};

const renderGetElementMethod = entity => {
  let output = `
 public IWebElement Get${entity.name}Element() 
 {
     return ${renderFindByLocatorStatement(entity.locators.find(l => l.selected))}
 }
`;
  if (entity.tagName === 'SELECT') {
    output += `
 public Select Get${entity.name}Select() 
 {
     return new Select(Get${entity.name}Element());
 }
 
 public void Set${entity.name}ByValue(String value) 
 {
     return Get${entity.name}Select().SelectByValue(value);
 }
 
 public void Set${entity.name}ByText(String text) 
 {
     return Get${entity.name}Select().SelectByText(text);
 }
`;
  }
  return output;
};

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return ` 
 public void Click${entity.name}() 
 {
     Get${entity.name}Element().Click();
 }
 `;
  }
  return '';
};

const renderGetAndSetCheckboxRadio = entity => `
 public Boolean Get${entity.name}() 
 {
     return Get${entity.name}Element().Selected();
 }
 
 public void Set${entity.name}(Boolean onOrOff) 
 {
     IWebElement el = Get${entity.name}Element();
     if( (onOrOff && !el.Selected()) || (!onOrOff && el.Selected())) 
     {
         el.Click(); 
     }
 }`;

const renderGetAndSetSelect = entity => `
 public String Get${entity.name}() 
 {
     return Get${entity.name}Select().SelectedOption.Text;
 }
`;

const renderGetAndSetMethods = entity => {
  if (['INPUT', 'TEXTAREA'].includes(entity.tagName)) {
    if (['checkbox', 'radio'].includes(entity.type)) {
      return renderGetAndSetCheckboxRadio(entity);
    }
    // regular input
    return `
 public String Get${entity.name}() 
 {
     return Get${entity.name}Element().GetAttribute("value");
 }
 
 public void Set${entity.name}(String value) 
 {
     Get${entity.name}Element().SendKeys(value);
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
 public String Get${entity.name}() 
 {
     Get${entity.name}Element().Text;
 }
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElementMethod(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
