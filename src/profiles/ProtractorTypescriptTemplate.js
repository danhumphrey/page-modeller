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
 get${entity.name}Element() {
   return element(by.${locator.name}(\`${locator.locator}\`));
 }
`;
};

const renderClickMethod = entity => {
  if (!isClickable(entity)) {
    return '';
  }
  return `
 click${entity.name}() {
   this.get${entity.name}Element().click();
 }
`;
};

const renderGetAndSetCheckboxRadio = entity => `
 get${entity.name}() {
   this.get${entity.name}Element().isSelected();
 }
 
 set${entity.name}(onOrOff: boolean) {
   const val = this.get${entity.name}();
   if( (onOrOff && !val) || (!onOrOff && val)) {
     const elmt = this.get${entity.name}Element();
     elmt.click(); 
   }
 }
`;

const renderGetAndSetSelect = entity => `
 get${entity.name}Text() {
   const elmt = this.get${entity.name}Element();
   return elmt.all(by.css('option[selected="selected"]')).getText();
 }
 
 get${entity.name}Value() {
   const elmt = this.get${entity.name}Element();
   return elmt.all(by.css('option[selected="selected"]')).getAttribute('value');
 }
 
 set${entity.name}ByValue(value: string) {
   const elmt = this.get${entity.name}Element();  
   elmt.all(by.css('option[value="' + value + '"]')).click();
 }
 
 set${entity.name}ByText(text: string) {
   const elmt = this.get${entity.name}Element();  
   elmt.all(by.xpath('option[.="' + text + '"]')).click(); 
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
 get${entity.name}() {
   const elmt = this.get${entity.name}Element();
   return elmt.getAttribute('value');
 }
 
 set${entity.name}(value: string) {
   const elmt = this.get${entity.name}Element();
   elmt.sendKeys(value);
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
 get${entity.name}() {
   const elmt = this.get${entity.name}Element();
   return elmt.getText();
 }
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElement(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
