import { describe, it, expect } from 'vitest';
import { generateSeleniumJavaPageObject } from '../../src/generators/selenium-java';
import { generateSeleniumCSharpPageObject } from '../../src/generators/selenium-csharp';
import { generateSeleniumPythonPageObject } from '../../src/generators/selenium-python';
import { emptyModel } from '../../src/model';
import { modelOf, EMAIL, SIGN_IN, COUNTRY, TOPPINGS, HEADING } from './fixtures/model';

// SPEC §17. The compile checks prove these build; this is about the decisions.
describe('the Selenium page-object shape', () => {
  it('names the class from the URL and takes the driver in the constructor', () => {
    expect(generateSeleniumJavaPageObject(modelOf('selenium-java', SIGN_IN))).toContain(
      ['public class LoginPage {', '    private final WebDriver driver;', '', '    public LoginPage(WebDriver driver) {', '        this.driver = driver;', '    }'].join('\n')
    );
    expect(generateSeleniumCSharpPageObject(modelOf('selenium-csharp', SIGN_IN))).toContain(
      ['public class LoginPage', '{', '    private readonly IWebDriver driver;', '', '    public LoginPage(IWebDriver driver)', '    {', '        this.driver = driver;', '    }'].join('\n')
    );
    expect(generateSeleniumPythonPageObject(modelOf('selenium-python', SIGN_IN))).toContain(
      ['class LoginPage:', '    def __init__(self, driver):', '        self.driver = driver'].join('\n')
    );
  });

  it('routes Python through self, which has no implicit receiver', () => {
    // Java and C# wrap the fragment unchanged; Python cannot, so every call
    // site is rewritten. That is the part that can silently go wrong.
    const out = generateSeleniumPythonPageObject(modelOf('selenium-python', EMAIL, COUNTRY));
    expect(out).toContain('    def get_email_address_element(self):\n        return self.driver.find_element(By.NAME, "email")');
    expect(out).toContain('    def set_email_address(self, value, clear_first=True):');
    expect(out).toContain('        el = self.get_email_address_element()');
    // The definition keeps its own name; only calls take the receiver.
    expect(out).toContain('    def get_country_select(self):\n        return Select(self.get_country_element())');
    expect(out).not.toContain('def self.');
  });

  it('imports only what the model needs', () => {
    const plain = generateSeleniumJavaPageObject(modelOf('selenium-java', SIGN_IN, HEADING));
    expect(plain).not.toContain('import org.openqa.selenium.support.ui.Select;');
    expect(plain).not.toContain('import java.util.List;');

    const selects = generateSeleniumJavaPageObject(modelOf('selenium-java', COUNTRY));
    expect(selects).toContain('import org.openqa.selenium.support.ui.Select;');
    // A single select never streams; only the multi one needs List.
    expect(selects).not.toContain('import java.util.List;');

    expect(generateSeleniumJavaPageObject(modelOf('selenium-java', TOPPINGS))).toContain('import java.util.stream.Collectors;');
    expect(generateSeleniumCSharpPageObject(modelOf('selenium-csharp', TOPPINGS))).toContain('using System.Linq;');
    expect(generateSeleniumCSharpPageObject(modelOf('selenium-csharp', SIGN_IN))).not.toContain('Support.UI');
  });

  it('separates methods with a blank line', () => {
    expect(generateSeleniumJavaPageObject(modelOf('selenium-java', EMAIL))).toContain('    }\n\n    public');
    expect(generateSeleniumPythonPageObject(modelOf('selenium-python', EMAIL))).toMatch(/\n\n    def get_email_address\(self\):/);
  });

  it('is a usable class for an empty model', () => {
    for (const gen of [generateSeleniumJavaPageObject, generateSeleniumCSharpPageObject, generateSeleniumPythonPageObject]) {
      const out = gen(emptyModel('selenium-java'));
      expect(out).toContain('GeneratedPage');
      expect(out).toContain('driver');
    }
  });
});
