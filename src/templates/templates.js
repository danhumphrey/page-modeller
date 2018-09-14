const seleniumwebdriverjava = (model) => {
  return `
${model.entities
  .map(
    entity =>
      `
/*
 * ${entity.name}
 * ***************************************************************
 */
 public WebElement get${entity.name}Element() {
 	${entity.locators
        .map(locator => `${locator.selected ? `return driver.findElement(By.${locator.name === 'css' ? 'cssSelector' : locator.name}("${locator.locator}"));` : ``}`)
        .join('')
        }	
 }
${
        entity.tagName === 'A' ||
        entity.tagName === 'BUTTON' ||
        entity.tagName === 'IMG' ||
        (entity.tagName === 'INPUT' && ['button', 'reset', 'image', 'submit'].includes(entity.type))
          ? ` public void click${entity.name}() {\n	get${entity.name}Element().click();\n }`
          : ''
        }
${
        ['INPUT', 'A', 'BUTTON', 'IMG', 'SELECT', 'TEXTAREA'].includes(entity.tagName) ? '' : ` public String get${entity.name}() {\n	get${entity.name}Element().getText();\n }`
        }
`
  )
  .join('')}
`};

export default {
  seleniumwebdriverjava
}