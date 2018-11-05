/* eslint-disable no-underscore-dangle */
import dom from './dom';

describe('getSameSiblingCount', () => {
  const getSameSiblingCount = dom.__get__('getSameSiblingCount');

  test('element with no siblings returns 0', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(getSameSiblingCount(element)).toBe(0);
  });

  test('element with no matching siblings returns 0', () => {
    document.body.innerHTML = `<input id="test" /><p>Paragraph</p><div><input id="unrelated" /></div>`;
    const element = document.getElementById('test');
    expect(getSameSiblingCount(element)).toBe(0);
  });

  test('element with matching sibling returns correct count', () => {
    document.body.innerHTML = `<input id="test" /><input id="unrelated" />`;
    const element = document.getElementById('test');
    expect(getSameSiblingCount(element)).toBe(1);
  });

  test('element with multiple matching siblings returns correct count', () => {
    document.body.innerHTML = `<input id="test" /><input id="unrelated" /><input id="another" /><input id="and-another" />`;
    const element = document.getElementById('test');
    expect(getSameSiblingCount(element)).toBe(3);
  });
});

describe('getIndexOfElement', () => {
  const getIndexOfElement = dom.__get__('getIndexOfElement');

  test('element with no siblings returns 0', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(getIndexOfElement(element)).toBe(0);
  });

  test('element with no matching siblings returns 0', () => {
    document.body.innerHTML = `<input id="test" /><p>Paragraph</p><div><input id="unrelated" /></div>`;
    const element = document.getElementById('test');
    expect(getIndexOfElement(element)).toBe(0);
  });

  test('element in first position of matching sibling returns index 0', () => {
    document.body.innerHTML = `<input id="test" /><input id="unrelated" />`;
    const element = document.getElementById('test');
    expect(getIndexOfElement(element)).toBe(0);
  });

  test('element in second position of multiple matching siblings returns index 1', () => {
    document.body.innerHTML = `<input id="unrelated" /><input id="test" /><input id="another" /><input id="and-another" />`;
    const element = document.getElementById('test');
    expect(getIndexOfElement(element)).toBe(1);
  });

  test('element in final position of 4 matching siblings returns index 3', () => {
    document.body.innerHTML = `<input id="unrelated" /><input id="another" /><input id="and-another" /><input id="test" />`;
    const element = document.getElementById('test');
    expect(getIndexOfElement(element)).toBe(3);
  });
});

describe('isElementOffScreen', () => {
  const isElementOffScreen = dom.__get__('isElementOffScreen');

  test('isElementOffScreen returns false for element within the viewport', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(isElementOffScreen(element)).toBe(false);
  });
  // not sure how to test off screen yet...
});
