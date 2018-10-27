/* eslint-disable no-underscore-dangle */
import xpath from './xpath';

describe('getElementNodeName', () => {
  const getElementNodeName = xpath.__get__('getElementNodeName');
  afterEach(() => {
    document.write(`<!DOCTYPE html><html lang="en"></html>`);
  });
  test('element node name in HTML document', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(getElementNodeName(element)).toBe('input');
  });
  test('element node name in XHTML document', () => {
    document.write(
      `<?xml version='1.0' encoding='utf-8'?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns='http://www.w3.org/1999/xhtml'> <head><title>T</title></head><body><p>paragraph</p></body></html>`
    );
    const element = document.querySelector('p');
    expect(getElementNodeName(element)).toBe('x:p');
  });
});

describe('uniqueXPath', () => {
  const uniqueXPath = xpath.__get__('uniqueXPath');
  test('xpath unchanged for single matching element', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    const xPathString = `//input[@id='test']`;
    expect(uniqueXPath(element, xPathString)).toBe(xPathString);
  });

  test('index appended to xpath for multiple matching elements', () => {
    document.body.innerHTML = `<p>One</p><p>Two</p>`;
    const els = document.querySelectorAll('p');
    const p1 = els[0];
    const p2 = els[1];
    expect(uniqueXPath(p1, '//p')).toBe('//p[1]');
    expect(uniqueXPath(p2, '//p')).toBe('//p[2]');
  });
});

describe('attributeValue', () => {
  const attributeValue = xpath.__get__('attributeValue');
  test('attribute value with single quotes is wrapped with double quotes', () => {
    expect(attributeValue(`'att'`)).toBe(`"'att'"`);
  });
  test('attribute value with double quotes is wrapped with single quotes', () => {
    expect(attributeValue(`"att"`)).toBe(`'"att"'`);
  });
  test('attribute value with unclosed single quotes is wrapped and concatenated', () => {
    expect(attributeValue(`"'att"`)).toBe(`concat('"',"'att",'"')`);
  });
  test('attribute value with unclosed double quotes is wrapped and concatenated', () => {
    expect(attributeValue(`'"att'`)).toBe(`concat("'",'"att',"'")`);
  });
});

describe('idBuilder', () => {
  const idBuilder = xpath.__get__('idBuilder');

  test('element without id returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(idBuilder(element)).toBe(false);
  });

  test('xpath for element with id', () => {
    document.body.innerHTML = '<input id="forename" />';
    const element = document.getElementById('forename');
    expect(idBuilder(element)).toBe(`//input[@id='forename']`);
  });

  test('xpath for multiple elements with duplicate id', () => {
    document.body.innerHTML = '<input id="surname" /><input id="surname" class="second" />';
    const element1 = document.getElementById('surname');
    const element2 = document.getElementsByClassName('second')[0];
    expect(idBuilder(element1)).toBe(`//input[@id='surname'][1]`);
    expect(idBuilder(element2)).toBe(`//input[@id='surname'][2]`);
  });
});

describe('nameBuilder', () => {
  const nameBuilder = xpath.__get__('nameBuilder');

  test('element without name returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(nameBuilder(element)).toBe(false);
  });

  test('xpath for element with name', () => {
    document.body.innerHTML = '<input name="forename" />';
    const element = document.querySelector(`input[name='forename']`);
    expect(nameBuilder(element)).toBe(`//input[@name='forename']`);
  });

  test('xpath for multiple elements with duplicate name', () => {
    document.body.innerHTML = '<input name="surname" /><input name="surname" class="second" />';
    const element1 = document.querySelector(`input[name='surname']`);
    const element2 = document.getElementsByClassName('second')[0];
    expect(nameBuilder(element1)).toBe(`//input[@name='surname'][1]`);
    expect(nameBuilder(element2)).toBe(`//input[@name='surname'][2]`);
  });
});

describe('ariaLabelBuilder', () => {
  const ariaLabelBuilder = xpath.__get__('ariaLabelBuilder');

  test('element without aria-label returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(ariaLabelBuilder(element)).toBe(false);
  });

  test('xpath for element with aria-label', () => {
    document.body.innerHTML = '<input aria-label="The Forename" />';
    const element = document.querySelector(`input`);
    expect(ariaLabelBuilder(element)).toBe(`//input[@aria-label='The Forename']`);
  });

  test('xpath for multiple elements with duplicate name', () => {
    document.body.innerHTML = '<input aria-label="Something" /><input aria-label="Something" class="second" />';
    const element1 = document.querySelector(`input`);
    const element2 = document.getElementsByClassName('second')[0];
    expect(ariaLabelBuilder(element1)).toBe(`//input[@aria-label='Something'][1]`);
    expect(ariaLabelBuilder(element2)).toBe(`//input[@aria-label='Something'][2]`);
  });
});

describe('linkTextBuilder', () => {
  const linkTextBuilder = xpath.__get__('linkTextBuilder');

  test('non A element returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(linkTextBuilder(element)).toBe(false);
  });

  test('A element without link text returns false', () => {
    document.body.innerHTML = '<a><img src="dummy" /></a>';
    const element = document.querySelector('a');
    expect(linkTextBuilder(element)).toBe(false);
  });

  test('A element with link text returns correct xpath', () => {
    document.body.innerHTML = '<a>Test</a>';
    const element = document.querySelector(`a`);
    expect(linkTextBuilder(element)).toBe(`//a[contains(text(),'Test')]`);
  });

  test('A element with link text and whitespace returns correct xpath', () => {
    document.body.innerHTML = '<a>     Test  </a>';
    const element = document.querySelector(`a`);
    expect(linkTextBuilder(element)).toBe(`//a[contains(text(),'Test')]`);
  });

  test('xpath for multiple elements with duplicate text', () => {
    document.body.innerHTML = '<a>Test</a><a class="second">Test</a>';
    const element1 = document.querySelector(`a`);
    const element2 = document.getElementsByClassName('second')[0];
    expect(linkTextBuilder(element1)).toBe(`//a[contains(text(),'Test')][1]`);
    expect(linkTextBuilder(element2)).toBe(`//a[contains(text(),'Test')][2]`);
  });
});

describe('linkHrefBuilder', () => {
  const linkHrefBuilder = xpath.__get__('linkHrefBuilder');

  test('non A element returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(linkHrefBuilder(element)).toBe(false);
  });

  test('A element without href attribute returns false', () => {
    document.body.innerHTML = '<a>One></a>';
    const element = document.querySelector('a');
    expect(linkHrefBuilder(element)).toBe(false);
  });

  test('A element with relative href attribute returns correct xpath', () => {
    document.body.innerHTML = '<a href="section/page.html"/>';
    const element = document.querySelector(`a`);
    expect(linkHrefBuilder(element)).toBe(`//a[contains(@href,'section/page.html')]`);
  });

  test('A element with absolute href attribute returns correct xpath', () => {
    document.body.innerHTML = '<a href="https://photos.google.com/images/kittens.html"/>';
    const element = document.querySelector(`a`);
    expect(linkHrefBuilder(element)).toBe(`//a[contains(@href,'images/kittens.html')]`);
  });

  test('xpath for multiple elements with matching href attribute', () => {
    document.body.innerHTML = '<a href="contact.html"/>Contact<a href="contact.html" class="second"/>';
    const element1 = document.querySelector(`a`);
    const element2 = document.getElementsByClassName('second')[0];
    expect(linkHrefBuilder(element1)).toBe(`//a[contains(@href,'contact.html')][1]`);
    expect(linkHrefBuilder(element2)).toBe(`//a[contains(@href,'contact.html')][2]`);
  });
});

describe('imageBuilder', () => {
  const imageBuilder = xpath.__get__('imageBuilder');

  test('non IMG element returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(imageBuilder(element)).toBe(false);
  });

  test('IMG element without alt, title or src returns false', () => {
    document.body.innerHTML = '<img class="dummy" />';
    const element = document.querySelector('img');
    expect(imageBuilder(element)).toBe(false);
  });

  test('IMG element with alt attribute returns correct xpath', () => {
    document.body.innerHTML = '<img alt="Test"/>';
    const element = document.querySelector(`img`);
    expect(imageBuilder(element)).toBe(`//img[@alt='Test']`);
  });

  test('xpath for multiple elements with matching alt attribute', () => {
    document.body.innerHTML = '<img alt="Test"/><img alt="Test" class="second"/>';
    const element1 = document.querySelector(`img`);
    const element2 = document.getElementsByClassName('second')[0];
    expect(imageBuilder(element1)).toBe(`//img[@alt='Test'][1]`);
    expect(imageBuilder(element2)).toBe(`//img[@alt='Test'][2]`);
  });

  test('IMG element with title attribute returns correct xpath', () => {
    document.body.innerHTML = '<img title="Profile"/>';
    const element = document.querySelector(`img`);
    expect(imageBuilder(element)).toBe(`//img[@title='Profile']`);
  });

  test('xpath for multiple elements with matching title attribute', () => {
    document.body.innerHTML = '<img title="Test"/><img title="Test" class="second"/>';
    const element1 = document.querySelector(`img`);
    const element2 = document.getElementsByClassName('second')[0];
    expect(imageBuilder(element1)).toBe(`//img[@title='Test'][1]`);
    expect(imageBuilder(element2)).toBe(`//img[@title='Test'][2]`);
  });

  test('IMG element with relative src attribute returns correct xpath', () => {
    document.body.innerHTML = '<img src="images/kittens.png"/>';
    const element = document.querySelector(`img`);
    expect(imageBuilder(element)).toBe(`//img[contains(@src,'images/kittens.png')]`);
  });

  test('IMG element with absolute src attribute returns correct xpath', () => {
    document.body.innerHTML = '<img src="https://photos.google.com/images/kittens.png"/>';
    const element = document.querySelector(`img`);
    expect(imageBuilder(element)).toBe(`//img[contains(@src,'images/kittens.png')]`);
  });

  test('xpath for multiple elements with matching src attribute', () => {
    document.body.innerHTML = '<img src="puppy.png"/><img src="puppy.png" class="second"/>';
    const element1 = document.querySelector(`img`);
    const element2 = document.getElementsByClassName('second')[0];
    expect(imageBuilder(element1)).toBe(`//img[contains(@src,'puppy.png')][1]`);
    expect(imageBuilder(element2)).toBe(`//img[contains(@src,'puppy.png')][2]`);
  });
});

describe('absoluteXPathBuilder', () => {
  const absoluteXPathBuilder = xpath.__get__('absoluteXPathBuilder');

  test('top level element returns correct xpath', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(absoluteXPathBuilder(element)).toBe('/html/body/p');
  });

  test('multiple siblings returns correct xpath', () => {
    document.body.innerHTML = '<div><p>Span 1</p><p class="second">Paragraph</p></div>';
    const element = document.querySelector('p.second');
    expect(absoluteXPathBuilder(element)).toBe('/html/body/div/p[2]');
  });
});

describe('relativeXPathBuilder', () => {
  const relativeXPathBuilder = xpath.__get__('relativeXPathBuilder');

  test('null element returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    expect(relativeXPathBuilder(null)).toBe(false);
  });

  test('unmatched element returns false', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(relativeXPathBuilder(element)).toBe(false);
  });

  test('parent element with id returns correct xpath', () => {
    document.body.innerHTML = '<div id="parent"><p>Paragraph</p></div>';
    const element = document.querySelector('p');
    expect(relativeXPathBuilder(element)).toBe(`//div[@id='parent']/p`);
  });

  test('ancestor element with id returns correct xpath', () => {
    document.body.innerHTML = '<div id="ancestor"><div><p>Paragraph</p></div></div>';
    const element = document.querySelector('p');
    expect(relativeXPathBuilder(element)).toBe(`//div[@id='ancestor']/div/p`);
  });

  test('ancestor element with multiple children returns correct xpath', () => {
    document.body.innerHTML = '<div id="ancestor"><div><span>Span</span></div><div><p>Paragraph</p></div></div>';
    const element = document.querySelector('p');
    expect(relativeXPathBuilder(element)).toBe(`//div[@id='ancestor']/div[2]/p`);
  });

  test('relative xpath from parent with multiple siblings returns correct xpath', () => {
    document.body.innerHTML = '<div id="parent"><p>Paragraph</p><p class="second">Paragraph</p></div>';
    const element1 = document.querySelector('p');
    const element2 = document.querySelector('p.second');
    expect(relativeXPathBuilder(element1)).toBe(`//div[@id='parent']/p[1]`);
    expect(relativeXPathBuilder(element2)).toBe(`//div[@id='parent']/p[2]`);
  });
});

describe('getXPath', () => {
  const getXPath = xpath.__get__('getXPath');

  test('element which matches preferred xpath', () => {
    document.body.innerHTML = '<a>Contact</a>';
    const element = document.querySelector('a');
    expect(getXPath(element)).toBe(`//a[contains(text(),'Contact')]`);
  });

  test('element which matches relative xpath', () => {
    document.body.innerHTML = '<div id="parent"><p>Paragraph</p></div>';
    const element = document.querySelector('p');
    expect(getXPath(element)).toBe(`//div[@id='parent']/p`);
  });

  test('element which matches absolute xpath', () => {
    document.body.innerHTML = '<p>Paragraph</p>';
    const element = document.querySelector('p');
    expect(getXPath(element)).toBe('/html/body/p');
  });
});
