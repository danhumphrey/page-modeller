import xpath from './xpath';

describe('getElementNodeName', () => {
  const getElementNodeName = xpath.__get__('getElementNodeName');
  test('element node name in HTML document', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(getElementNodeName(element)).toBe('input');
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
