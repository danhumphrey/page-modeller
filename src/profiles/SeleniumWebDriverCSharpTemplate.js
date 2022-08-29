import upperFirst from 'lodash/upperFirst';
import { isClickable, isInteractive } from './templates-helpers';

const renderEntityComment = entity => `

// ${entity.name}`;

const transformLocatorName = locatorName => {
  if (locatorName === 'css' || locatorName === 'customLocator') {
    return 'CssSelector';
  }
  if (locatorName === 'xpath') {
    return 'XPath';
  }
  return upperFirst(locatorName);
};

const renderFindByLocatorStatement = locator => `_driver.FindElement(By.${transformLocatorName(locator.name)}("${locator.locator}"));`;

const renderGetElementMethod = entity => {
  let output = `
public IWebElement ${entity.name}Element => ${renderFindByLocatorStatement(entity.locators.find(l => l.selected))}`;
  if (entity.tagName === 'SELECT') {
    output += `
public SelectElement Get${entity.name}Select() => new SelectElement(${entity.name}Element);
`;
  }
  return output;
};

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return `
public void Click${entity.name}() => ${entity.name}Element.Click();`;
  }
  return '';
};

const renderGetAndSetCheckboxRadio = entity => `
public bool ${entity.name} => ${entity.name}Element.Selected;

public void Set${entity.name}(bool onOrOff) 
{
    IWebElement el = ${entity.name}Element;
    if( (onOrOff && !el.Selected) || (!onOrOff && el.Selected)) 
    {
        el.Click(); 
    }
}`;

const renderGetAndSetSelect = entity => `
public string Get${entity.name}Text => Get${entity.name}Select().SelectedOption.Text;
public string Get${entity.name}Value => Get${entity.name}Select().SelectedOption.GetAttribute("value");
public void Set${entity.name}ByValue(string value) => Get${entity.name}Select().SelectByValue(value);
public void Set${entity.name}ByText(string text) => Get${entity.name}Select().SelectByText(text);
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
public string ${entity.name} => ${entity.name}Element.GetAttribute("value");
public void Set${entity.name}(string value) => ${entity.name}Element.SendKeys(value);
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
public string Get${entity.name}() 
{
    return Get${entity.name}Element().Text;
}
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElementMethod(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
