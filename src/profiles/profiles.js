import SeleniumWebDriverJavaTemplate from './SeleniumWebDriverJavaTemplate';
import SeleniumWebDriverCSharpTemplate from './SeleniumWebDriverCSharpTemplate';
import RobotFrameworkTemplate from './RobotFrameworkTemplate';
import PuppeteerTemplate from './PuppeteerTemplate';
import ProtractorTemplate from './ProtractorTemplate';
import ProtractorTypescriptTemplate from './ProtractorTypescriptTemplate';

export default [
  {
    name: 'Selenium WebDriver Java',
    template: SeleniumWebDriverJavaTemplate,
    locators: ['customLocator', 'id', 'linkText', 'partialLinkText', 'name', 'css','xpath', 'className', 'tagName'],
  },
  {
    name: 'Selenium WebDriver C#',
    template: SeleniumWebDriverCSharpTemplate,
    locators: ['customLocator', 'id', 'linkText', 'partialLinkText', 'name', 'css', 'xpath', 'className', 'tagName'],
  },
  {
    name: 'Robot Framework',
    template: RobotFrameworkTemplate,
    locators: ['customLocator', 'id', 'linkText', 'name', 'css', 'xpath', 'tagName'],
  },
  {
    name: 'Puppeteer',
    template: PuppeteerTemplate,
    locators: ['customLocator', 'css', 'xpath'],
  },
  {
    name: 'Protractor',
    template: ProtractorTemplate,
    locators: ['customLocator', 'id', 'linkText', 'partialLinkText', 'name', 'model', 'binding', 'css', 'xpath', 'className', 'tagName'],
  },
  {
    name: 'Protractor (Typescript)',
    template: ProtractorTypescriptTemplate,
    locators: ['customLocator', 'id', 'linkText', 'partialLinkText', 'name', 'model', 'binding', 'css', 'xpath', 'className', 'tagName'],
  }
];
