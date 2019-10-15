import dom from './dom';

export default locator => {
  let matches;

  switch (locator.name) {
    case 'xpath':
      matches = dom.findElementsByXPath(document, locator.locator);
      break;
    case 'css':
      matches = dom.findElementsByCssSelector(document, locator.locator);
      break;
    case 'name':
      matches = dom.findElementsByName(document, locator.locator);
      break;
    case 'tagName':
      matches = dom.findElementsByTagName(document, locator.locator);
      break;
    case 'tagIndex':
      matches = dom.findElementsByTagIndex(document, locator.locator);
      break;
    case 'className':
      matches = dom.findElementsByClassName(document, locator.locator);
      break;
    case 'id':
      matches = dom.findElementsById(document, locator.locator);
      break;
    case 'linkText':
      matches = dom.findElementsByLinkText(document, locator.locator);
      break;
    case 'partialLinkText':
      matches = dom.findElementsByPartialLinkText(document, locator.locator);
      break;
    case 'model':
      matches = dom.findElementsByNgModel(document, locator.locator);
      break;
    case 'binding':
      matches = dom.findElementsByNgBinding(document, locator.locator);
      break;
    default:
      console.error(`Unexpected locator ${locator}`);
  }
  return [...matches];
};
