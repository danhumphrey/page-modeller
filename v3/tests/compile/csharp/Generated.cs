using System.Collections.Generic;
using System.Linq;
using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

class Methods
{
    IWebDriver driver;
/*
 * ActionableEl
 * ***************************************************************
 */

public IWebElement GetActionableElElement()
{
    return driver.FindElement(By.CssSelector("button.pay"));
}

public void ClickActionableEl()
{
    GetActionableElElement().Click();
}

/*
 * TextEl
 * ***************************************************************
 */

public IWebElement GetTextElElement()
{
    return driver.FindElement(By.CssSelector("input.email"));
}

public string GetTextEl()
{
    return GetTextElElement().GetDomProperty("value");
}

public void SetTextEl(string value, bool clearFirst = true)
{
    IWebElement el = GetTextElElement();
    if (clearFirst)
    {
        el.Clear();
    }
    el.SendKeys(value);
}

/*
 * ToggleEl
 * ***************************************************************
 */

public IWebElement GetToggleElElement()
{
    return driver.FindElement(By.CssSelector("input.remember"));
}

public bool IsToggleElChecked()
{
    return GetToggleElElement().Selected;
}

public void SetToggleEl(bool isChecked)
{
    IWebElement el = GetToggleElElement();
    if (el.Selected != isChecked)
    {
        el.Click();
    }
}

/*
 * RadioEl
 * ***************************************************************
 */

public IWebElement GetRadioElElement()
{
    return driver.FindElement(By.CssSelector("input.plan"));
}

public bool IsRadioElSelected()
{
    return GetRadioElElement().Selected;
}

public void SelectRadioEl()
{
    IWebElement el = GetRadioElElement();
    if (!el.Selected)
    {
        el.Click();
    }
}

/*
 * SelectEl
 * ***************************************************************
 */

public IWebElement GetSelectElElement()
{
    return driver.FindElement(By.CssSelector("select.country"));
}

public SelectElement GetSelectElSelect()
{
    return new SelectElement(GetSelectElElement());
}

public string GetSelectElText()
{
    return GetSelectElSelect().SelectedOption.Text;
}

public string GetSelectElValue()
{
    return GetSelectElSelect().SelectedOption.GetDomProperty("value");
}

public void SetSelectElByValue(string value)
{
    GetSelectElSelect().SelectByValue(value);
}

public void SetSelectElByText(string text)
{
    GetSelectElSelect().SelectByText(text);
}

/*
 * MultiSelectEl
 * ***************************************************************
 */

public IWebElement GetMultiSelectElElement()
{
    return driver.FindElement(By.CssSelector("select.toppings"));
}

public SelectElement GetMultiSelectElSelect()
{
    return new SelectElement(GetMultiSelectElElement());
}

public IList<string> GetMultiSelectElTexts()
{
    return GetMultiSelectElSelect().AllSelectedOptions.Select(o => o.Text).ToList();
}

public IList<string> GetMultiSelectElValues()
{
    return GetMultiSelectElSelect().AllSelectedOptions.Select(o => o.GetDomProperty("value")).ToList();
}

public void SetMultiSelectElByValues(params string[] values)
{
    SelectElement el = GetMultiSelectElSelect();
    el.DeselectAll();
    foreach (string value in values)
    {
        el.SelectByValue(value);
    }
}

public void SetMultiSelectElByTexts(params string[] texts)
{
    SelectElement el = GetMultiSelectElSelect();
    el.DeselectAll();
    foreach (string text in texts)
    {
        el.SelectByText(text);
    }
}

public void DeselectAllMultiSelectEl()
{
    GetMultiSelectElSelect().DeselectAll();
}

/*
 * StaticEl
 * ***************************************************************
 */

public IWebElement GetStaticElElement()
{
    return driver.FindElement(By.CssSelector("h1"));
}

public string GetStaticEl()
{
    return GetStaticElElement().Text;
}

/*
 * ImageEl
 * ***************************************************************
 */

public IWebElement GetImageElElement()
{
    return driver.FindElement(By.CssSelector("img.logo"));
}

public string GetImageElAltText()
{
    return GetImageElElement().GetDomAttribute("alt");
}

/*
 * PasswordEl
 * ***************************************************************
 */

public IWebElement GetPasswordElElement()
{
    return driver.FindElement(By.CssSelector("input.pass"));
}

public string GetPasswordEl()
{
    return GetPasswordElElement().GetDomProperty("value");
}

public void SetPasswordEl(string value, bool clearFirst = true)
{
    IWebElement el = GetPasswordElElement();
    if (clearFirst)
    {
        el.Clear();
    }
    el.SendKeys(value);
}

/*
 * FramedActionableEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public void ClickFramedActionableEl()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        driver.FindElement(By.CssSelector("button.pay")).Click();
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedTextEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public string GetFramedTextEl()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return driver.FindElement(By.CssSelector("input.email")).GetDomProperty("value");
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SetFramedTextEl(string value, bool clearFirst = true)
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        IWebElement el = driver.FindElement(By.CssSelector("input.email"));
        if (clearFirst)
        {
            el.Clear();
        }
        el.SendKeys(value);
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedToggleEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public bool IsFramedToggleElChecked()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return driver.FindElement(By.CssSelector("input.remember")).Selected;
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SetFramedToggleEl(bool isChecked)
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        IWebElement el = driver.FindElement(By.CssSelector("input.remember"));
        if (el.Selected != isChecked)
        {
            el.Click();
        }
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedRadioEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public bool IsFramedRadioElSelected()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return driver.FindElement(By.CssSelector("input.plan")).Selected;
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SelectFramedRadioEl()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        IWebElement el = driver.FindElement(By.CssSelector("input.plan"));
        if (!el.Selected)
        {
            el.Click();
        }
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedSelectEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public string GetFramedSelectElText()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return new SelectElement(driver.FindElement(By.CssSelector("select.country"))).SelectedOption.Text;
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public string GetFramedSelectElValue()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return new SelectElement(driver.FindElement(By.CssSelector("select.country"))).SelectedOption.GetDomProperty("value");
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SetFramedSelectElByValue(string value)
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        new SelectElement(driver.FindElement(By.CssSelector("select.country"))).SelectByValue(value);
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SetFramedSelectElByText(string text)
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        new SelectElement(driver.FindElement(By.CssSelector("select.country"))).SelectByText(text);
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedMultiSelectEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public IList<string> GetFramedMultiSelectElTexts()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return new SelectElement(driver.FindElement(By.CssSelector("select.toppings"))).AllSelectedOptions.Select(o => o.Text).ToList();
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public IList<string> GetFramedMultiSelectElValues()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return new SelectElement(driver.FindElement(By.CssSelector("select.toppings"))).AllSelectedOptions.Select(o => o.GetDomProperty("value")).ToList();
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SetFramedMultiSelectElByValues(params string[] values)
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        SelectElement el = new SelectElement(driver.FindElement(By.CssSelector("select.toppings")));
        el.DeselectAll();
        foreach (string value in values)
        {
            el.SelectByValue(value);
        }
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SetFramedMultiSelectElByTexts(params string[] texts)
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        SelectElement el = new SelectElement(driver.FindElement(By.CssSelector("select.toppings")));
        el.DeselectAll();
        foreach (string text in texts)
        {
            el.SelectByText(text);
        }
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void DeselectAllFramedMultiSelectEl()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        new SelectElement(driver.FindElement(By.CssSelector("select.toppings"))).DeselectAll();
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedStaticEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public string GetFramedStaticEl()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return driver.FindElement(By.CssSelector("h1")).Text;
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedImageEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public string GetFramedImageElAltText()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return driver.FindElement(By.CssSelector("img.logo")).GetDomAttribute("alt");
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * FramedPasswordEl
 * In frame: #same-frame › #deep-frame
 * ***************************************************************
 */

public string GetFramedPasswordEl()
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        return driver.FindElement(By.CssSelector("input.pass")).GetDomProperty("value");
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

public void SetFramedPasswordEl(string value, bool clearFirst = true)
{
    driver.SwitchTo().DefaultContent();
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
    driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
    try
    {
        IWebElement el = driver.FindElement(By.CssSelector("input.pass"));
        if (clearFirst)
        {
            el.Clear();
        }
        el.SendKeys(value);
    }
    finally
    {
        driver.SwitchTo().DefaultContent();
    }
}

/*
 * ById
 * ***************************************************************
 */

public IWebElement GetByIdElement()
{
    return driver.FindElement(By.Id("go"));
}

public void ClickById()
{
    GetByIdElement().Click();
}

/*
 * ByName
 * ***************************************************************
 */

public IWebElement GetByNameElement()
{
    return driver.FindElement(By.Name("email"));
}

public string GetByName()
{
    return GetByNameElement().GetDomProperty("value");
}

public void SetByName(string value, bool clearFirst = true)
{
    IWebElement el = GetByNameElement();
    if (clearFirst)
    {
        el.Clear();
    }
    el.SendKeys(value);
}

/*
 * ByClassName
 * ***************************************************************
 */

public IWebElement GetByClassNameElement()
{
    return driver.FindElement(By.ClassName("row"));
}

public string GetByClassName()
{
    return GetByClassNameElement().Text;
}

/*
 * ByTagName
 * ***************************************************************
 */

public IWebElement GetByTagNameElement()
{
    return driver.FindElement(By.TagName("h1"));
}

public string GetByTagName()
{
    return GetByTagNameElement().Text;
}

/*
 * ByLinkText
 * ***************************************************************
 */

public IWebElement GetByLinkTextElement()
{
    return driver.FindElement(By.LinkText("Create new account"));
}

public void ClickByLinkText()
{
    GetByLinkTextElement().Click();
}

/*
 * ByPartialLinkText
 * ***************************************************************
 */

public IWebElement GetByPartialLinkTextElement()
{
    return driver.FindElement(By.PartialLinkText("Create"));
}

public void ClickByPartialLinkText()
{
    GetByPartialLinkTextElement().Click();
}

/*
 * ByCss
 * ***************************************************************
 */

public IWebElement GetByCssElement()
{
    return driver.FindElement(By.CssSelector("div.row"));
}

public string GetByCss()
{
    return GetByCssElement().Text;
}

/*
 * ByXpath
 * ***************************************************************
 */

public IWebElement GetByXpathElement()
{
    return driver.FindElement(By.XPath("/html[1]/body[1]/div[2]"));
}

public string GetByXpath()
{
    return GetByXpathElement().Text;
}
}

class Locators
{
private readonly By _actionableEl = By.CssSelector("button.pay");
private readonly By _textEl = By.CssSelector("input.email");
private readonly By _toggleEl = By.CssSelector("input.remember");
private readonly By _radioEl = By.CssSelector("input.plan");
private readonly By _selectEl = By.CssSelector("select.country");
private readonly By _multiSelectEl = By.CssSelector("select.toppings");
private readonly By _staticEl = By.CssSelector("h1");
private readonly By _imageEl = By.CssSelector("img.logo");
private readonly By _passwordEl = By.CssSelector("input.pass");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedActionableEl = By.CssSelector("button.pay");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedTextEl = By.CssSelector("input.email");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedToggleEl = By.CssSelector("input.remember");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedRadioEl = By.CssSelector("input.plan");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedSelectEl = By.CssSelector("select.country");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedMultiSelectEl = By.CssSelector("select.toppings");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedStaticEl = By.CssSelector("h1");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedImageEl = By.CssSelector("img.logo");
// In frame: #same-frame › #deep-frame
// driver.SwitchTo().DefaultContent();
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#same-frame")));
// driver.SwitchTo().Frame(driver.FindElement(By.CssSelector("#deep-frame")));
private readonly By _framedPasswordEl = By.CssSelector("input.pass");
private readonly By _byId = By.Id("go");
private readonly By _byName = By.Name("email");
private readonly By _byClassName = By.ClassName("row");
private readonly By _byTagName = By.TagName("h1");
private readonly By _byLinkText = By.LinkText("Create new account");
private readonly By _byPartialLinkText = By.PartialLinkText("Create");
private readonly By _byCss = By.CssSelector("div.row");
private readonly By _byXpath = By.XPath("/html[1]/body[1]/div[2]");
}