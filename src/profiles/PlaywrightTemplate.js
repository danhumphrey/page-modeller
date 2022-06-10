import { isClickable, isInteractive } from './templates-helpers';

const renderEntityComment = entity => `
/*
 * ${entity.name}
 * ***************************************************************
 */
`;
const getSelectedLocator = entity => entity.locators.find(l => l.selected);
const renderGetLocator = entity => {
  const locator = getSelectedLocator(entity);
  return `
 get${entity.name}Locator() {
   return this.page.locator(\`${locator.locator}\`);
 }  
`;
};

const renderClickMethod = entity => {
  if (!isClickable(entity)) {
    return '';
  }
  return `
 async click${entity.name}() {
   const locator = this.get${entity.name}Locator(); 
   await locator.click();
 }
`;
};

const renderGetAndSetCheckboxRadio = entity => `
 async get${entity.name}() {
   const locator = this.get${entity.name}Locator();
   return await locator.isChecked();
 }
 
 async set${entity.name}(onOrOff :boolean) {
    const locator = this.get${entity.name}Locator(); 
    await locator.setChecked(onOrOff);
 }
`;

const renderGetAndSetSelect = entity => `
 async get${entity.name}Text() {
   const locator = this.get${entity.name}Locator();
   return await locator.evaluate(
    (sel: HTMLSelectElement) => sel.options[sel.selectedIndex].textContent
  );
 }
 
 async get${entity.name}Value() {
   const locator = this.get${entity.name}Locator();
   return await locator.inputValue();
 }
 
 async set${entity.name}ByValue(val :string) {
  const locator = this.get${entity.name}Locator();  
  await locator.selectOption({value: val});
 }
 
 async set${entity.name}ByText(text :string) {
   const locator = this.get${entity.name}Locator();  
   await locator.selectOption({label: text});
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
 async get${entity.name}Value() {
   const locator = this.get${entity.name}Locator();
   return await locator.inputValue();
 }
 
 async set${entity.name}(value :string) {
   const locator = this.get${entity.name}Locator();
   await locator.fill(value);
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
 async get${entity.name}() {
   const locator = this.get${entity.name}Locator();
   return await locator.innerText();
 }
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetLocator(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
