import { isClickable, isInteractive } from './templates-helpers';

const renderEntityComment = entity => `
/*
 * ${entity.name}
 * ***************************************************************
 */
`;
const getSelectedLocator = entity => entity.locators.find(l => l.selected);
const renderGetElement = entity => {
  const locator = getSelectedLocator(entity);
  return `
 this.get${entity.name}Element = function() {
   return element(by.${locator.name}('${locator.locator}'));
 }  
`;
};

const renderClickMethod = entity => {
  if (!isClickable(entity)) {
    return '';
  }
  return `
 this.click${entity.name} = function() {
   this.get${entity.name}Element().click();
 }
`;
};

const renderGetAndSetCheckboxRadio = entity => `
 this.get${entity.name} = function() {
   this.get${entity.name}Element().isSelected();
 }
 
 this.set${entity.name}(onOrOff) {
   var val = this.get${entity.name}();
   if( (onOrOff && !val) || (!onOrOff && val)) {
     var element = this.get${entity.name}Element();
     element.click(); 
   }
 }
`;

const renderGetAndSetSelect = entity => `
 this.get${entity.name}Text = function() {
   var element = this.get${entity.name}Element();
   return element.all(by.css('option[selected="selected"]')).getText();
 }
 
 this.get${entity.name}Value = function() {
   var element = this.get${entity.name}Element();
   return element.all(by.css('option[selected="selected"]')).getAttribute('value');
 }
 
 this.set${entity.name}ByValue = function(value) {
   var element = this.get${entity.name}Element();  
   element.all(by.css('option[value="' + value + '"]')).click();
 }
 
 this.set${entity.name}ByText = function(text) {
   var element = this.get${entity.name}Element();  
   element.all(by.xpath('option[.="' + text + '"]')).click(); 
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
 this.get${entity.name} = function() {
   var element = this.get${entity.name}Element();
   return element.getAttribute('value');
 }
 
 this.set${entity.name} = function(value) {
   var element = this.get${entity.name}Element();
   element.sendKeys(value);
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
 this.get${entity.name} = function() {
   var element = this.get${entity.name}Element();
   return element.getText();
 }
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElement(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
