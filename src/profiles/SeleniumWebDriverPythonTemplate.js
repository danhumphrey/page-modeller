import { isClickable, isInteractive } from './templates-helpers';

const renderEntityComment = entity => `
    # ${entity.name}`;

const transformLocatorName = locatorName => {
  if (locatorName === 'css') {
    return 'CSS_SELECTOR';
  }
  if (locatorName === 'xpath') {
    return 'XPATH';
  }
  if (locatorName === 'linkText') {
    return 'LINK_TEXT';
  }
  if (locatorName === 'partialLinkText') {
    return 'PARTIAL_LINK_TEXT';
  }
  if (locatorName === 'name') {
    return 'NAME';
  }
  if (locatorName === 'className') {
    return 'CLASS_NAME';
  }
  if (locatorName === 'tagName') {
    return 'TAG_NAME';
  }
  if (locatorName === 'id') {
    return 'ID';
  }
  return locatorName.toUpperCase();
};

const renderFindByLocatorStatement = locator => `self._driver.find_element(By.${transformLocatorName(locator.name)},"${locator.locator}")`;

const renderGetElementMethod = entity => {
  let output = `
    def ${entity.name}_element(self):
        return ${renderFindByLocatorStatement(entity.locators.find(l => l.selected))}
`;
  if (entity.tagName === 'SELECT') {
    output += `
    def get_${entity.name}_select(self):
        return TheSelect(self.${entity.name}_element())
`;
  }
  return output;
};

const renderClickMethod = entity => {
  if (isClickable(entity)) {
    return `
    def click_${entity.name}(self):
        self.${entity.name}_element().click()
`;
  }
  return '';
};

const renderGetAndSetCheckboxRadio = entity => `
    def get_${entity.name}(self):
        return self.${entity.name}_element().is_selected()

    def set_${entity.name}(self,on_or_off): 
        el = self.${entity.name}_element()
        if((on_or_off and not el.is_selected()) or (not on_or_off and el.is_selected())): 
            el.click()
`;

const renderGetAndSetSelect = entity => `
    def get_${entity.name}_text(self):
        return self.get_${entity.name}_select().first_selected_option.text
        
    def get_${entity.name}_value(self):
        self.get_${entity.name}_select().first_selected_option.get_attribute("value")
        
    def set_${entity.name}_by_value(self,value):
        self.get_${entity.name}_select().select_by_value(value)
        
    def get_${entity.name}_by_text(self,text):
        self.get_${entity.name}_select().select_by_visible_text(text)
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
    def get_${entity.name}(self): 
        self.${entity.name}_element().get_attribute("value")

    def set_${entity.name}(self,value):
        self.${entity.name}_element().send_keys(value)
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
    def get_${entity.name}(self): 
        return self.${entity.name}_element().text
`;
};

export default model =>
  model.entities
    .map(entity => `${renderEntityComment(entity)}${renderGetElementMethod(entity)}${renderClickMethod(entity)}${renderGetAndSetMethods(entity)}${renderGetTextMethod(entity)}`)
    .join('');
