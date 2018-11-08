import SeleniumWebDriverJavaTemplate from './SeleniumWebDriverJavaTemplate';
import SeleniumWebDriverCSharpTemplate from './SeleniumWebDriverCSharpTemplate';
import RobotFrameworkTemplate from './RobotFrameworkTemplate';
import PuppeteerTemplate from './PuppeteerTemplate';
import ProtractorTemplate from './ProtractorTemplate';

export default [
  {
    name: 'Selenium WebDriver Java',
    template: SeleniumWebDriverJavaTemplate,
    locators: ['id', 'linkText', 'partialLinkText', 'name', 'css', 'xpath', 'className', 'tagName'],
  },
  {
    name: 'Selenium WebDriver C#',
    template: SeleniumWebDriverCSharpTemplate,
    locators: ['id', 'linkText', 'partialLinkText', 'name', 'css', 'xpath', 'className', 'tagName'],
  },
  {
    name: 'Robot Framework',
    template: RobotFrameworkTemplate,
    locators: ['id', 'linkText', 'name', 'css', 'xpath', 'tagName'],
  },
  {
    name: 'Puppeteer',
    template: PuppeteerTemplate,
    locators: ['css', 'xpath'],
  },
  {
    name: 'Protractor',
    template: ProtractorTemplate,
    locators: ['id', 'linkText', 'partialLinkText', 'name', 'model', 'binding', 'css', 'xpath', 'className', 'tagName'],
  },
];
