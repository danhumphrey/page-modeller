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

describe('getElementIndex', () => {
  const getElementIndex = dom.__get__('getElementIndex');

  test('element with no siblings returns 0', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(getElementIndex(element)).toBe(0);
  });

  test('element with no matching siblings returns 0', () => {
    document.body.innerHTML = `<input id="test" /><p>Paragraph</p><div><input id="unrelated" /></div>`;
    const element = document.getElementById('test');
    expect(getElementIndex(element)).toBe(0);
  });

  test('element in first position of matching sibling returns index 0', () => {
    document.body.innerHTML = `<input id="test" /><input id="unrelated" />`;
    const element = document.getElementById('test');
    expect(getElementIndex(element)).toBe(0);
  });

  test('element in second position of multiple matching siblings returns index 1', () => {
    document.body.innerHTML = `<input id="unrelated" /><input id="test" /><input id="another" /><input id="and-another" />`;
    const element = document.getElementById('test');
    expect(getElementIndex(element)).toBe(1);
  });

  test('element in final position of 4 matching siblings returns index 3', () => {
    document.body.innerHTML = `<input id="unrelated" /><input id="another" /><input id="and-another" /><input id="test" />`;
    const element = document.getElementById('test');
    expect(getElementIndex(element)).toBe(3);
  });
});

describe('getElementBox', () => {
  console.log('getElementBox requires manual testing');
});

describe('getScrollPosition', () => {
  console.log('getScrollPosition requires manual testing');
});

describe('isElementOffScreen', () => {
  console.log('isElementOffScreen requires manual testing');
});

describe('isElementHidden', () => {
  console.log('isElementHidden requires manual testing');
});

describe('isVisible', () => {
  console.log('isVisible requires manual testing');
});

describe('getTagName', () => {
  const getTagName = dom.__get__('getTagName');

  test('correct tag name returned for element', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(getTagName(element)).toBe('INPUT');
  });
});

describe('getTagType', () => {
  const getTagType = dom.__get__('getTagType');

  test('element without type attribute returns null', () => {
    document.body.innerHTML = `<p id="test">Para</p>`;
    const element = document.getElementById('test');
    expect(getTagType(element)).toBe(null);
  });

  test('implied "text" type returned for input element', () => {
    document.body.innerHTML = `<input id="test" />`;
    const element = document.getElementById('test');
    expect(getTagType(element)).toBe('text');
  });

  test('correct type returned', () => {
    document.body.innerHTML = `<input id="test" type="button" />`;
    const element = document.getElementById('test');
    expect(getTagType(element)).toBe('button');
  });
});

describe('getTagIndex', () => {
  const getTagIndex = dom.__get__('getTagIndex');

  test('index of first element with matching siblings', () => {
    document.body.innerHTML = `<p id="test1">Para 1</p><p id="test2">Para 2</p><p id="test3">Para 3</p>`;
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    const element3 = document.getElementById('test3');

    expect(getTagIndex(element1)).toBe(1);
    expect(getTagIndex(element2)).toBe(2);
    expect(getTagIndex(element3)).toBe(3);
  });

  test('index of element with matching siblings in nested document', () => {
    document.body.innerHTML = `<div><p id="test1">Para 1</p><div><p id="test2">Para 2</p></div><p id="test3">Para 3</p></div><div><p id="test4">Para 4</p></div>`;

    const element = document.getElementById('test2');

    expect(getTagIndex(element)).toBe(2);
  });
});

describe('getId', () => {
  const getId = dom.__get__('getId');

  test('element without id returns null', () => {
    document.body.innerHTML = `<p class="test1">Para 1</p>`;
    const element = document.getElementsByClassName('test1')[0];
    expect(getId(element)).toBe(null);
  });

  test('element with id', () => {
    document.body.innerHTML = `<p id="test1">Para 1</p>`;
    const element = document.getElementById('test1');
    expect(getId(element)).toBe('test1');
  });

  test('element with id and whitespace', () => {
    document.body.innerHTML = `<p id="  test1     " class="p">Para 1</p>`;
    const element = document.getElementsByClassName('p')[0];
    expect(getId(element)).toBe('test1');
  });
});

describe('getName', () => {
  const getName = dom.__get__('getName');

  test('element without name returns null', () => {
    document.body.innerHTML = `<p class="test1">Para 1</p>`;
    const element = document.getElementsByClassName('test1')[0];
    expect(getName(element)).toBe(null);
  });

  test('element with name', () => {
    document.body.innerHTML = `<input id="test1" name="Test" />`;
    const element = document.getElementById('test1');
    expect(getName(element)).toBe('Test');
  });

  test('element with name and whitespace', () => {
    document.body.innerHTML = `<input id="test1" name="   Test " />`;
    const element = document.getElementById('test1');
    expect(getName(element)).toBe('Test');
  });
});

describe('getTextContent', () => {
  const getTextContent = dom.__get__('getTextContent');

  test('element without textContent returns null', () => {
    document.body.innerHTML = `<input id="test1" />`;
    const element = document.getElementById('test1');
    expect(getTextContent(element)).toBe(null);
  });

  test('element with other returns null', () => {
    document.body.innerHTML = `<p id="test1"><img src="js.png" /></p>`;
    const element = document.getElementById('test1');
    expect(getTextContent(element)).toBe(null);
  });

  test('element with textContent', () => {
    document.body.innerHTML = `<p id="test1">Test</p>`;
    const element = document.getElementById('test1');
    expect(getTextContent(element)).toBe('Test');
  });

  test('element with textContent and whitespace', () => {
    document.body.innerHTML = `<p id="test1"> Test  </p>`;
    const element = document.getElementById('test1');
    expect(getTextContent(element)).toBe('Test');
  });
});

describe('getClassName', () => {
  const getClassName = dom.__get__('getClassName');

  test('element without class returns null', () => {
    document.body.innerHTML = `<input id="test1" />`;
    const element = document.getElementById('test1');
    expect(getClassName(element)).toBe(null);
  });

  test('element with class returns it', () => {
    document.body.innerHTML = `<p id="test1" class="my-test">Test</p>`;
    const element = document.getElementById('test1');
    expect(getClassName(element)).toBe('my-test');
  });

  test('element with whitespace in class attribute returns first classname', () => {
    document.body.innerHTML = `<p id="test1" class="   my-test">Test</p>`;
    const element = document.getElementById('test1');
    expect(getClassName(element)).toBe('my-test');
  });

  test('element with multiple classes returns only the first', () => {
    document.body.innerHTML = `<p id="test1" class="my-test my-button big">Test</p>`;
    const element = document.getElementById('test1');
    expect(getClassName(element)).toBe('my-test');
  });
});

describe('getClassNames', () => {
  const getClassNames = dom.__get__('getClassNames');

  test('element without class returns empty array', () => {
    document.body.innerHTML = `<input id="test1" />`;
    const element = document.getElementById('test1');
    expect(getClassNames(element)).toEqual([]);
  });

  test('element with class returns it in an array', () => {
    document.body.innerHTML = `<p id="test1" class="my-test">Test</p>`;
    const element = document.getElementById('test1');
    expect(getClassNames(element)).toEqual(['my-test']);
  });

  test('element with multiple classes returns all in an array', () => {
    document.body.innerHTML = `<p id="test1" class="my-test my-button big">Test</p>`;
    const element = document.getElementById('test1');
    expect(getClassNames(element)).toEqual(['my-test', 'my-button', 'big']);
  });
});

describe('getUniqueClassName', () => {
  const getUniqueClassName = dom.__get__('getUniqueClassName');

  test('element without class attribute returns null', () => {
    document.body.innerHTML = `<input id="test1" />`;
    const element = document.getElementById('test1');
    expect(getUniqueClassName(element)).toBe(null);
  });

  test('element without unique class name returns null', () => {
    document.body.innerHTML = `<input id="test1" class="form-element"/><input id="test2" class="form-element"/>`;
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(getUniqueClassName(element1)).toBe(null);
    expect(getUniqueClassName(element2)).toBe(null);
  });

  test('element with unique class name', () => {
    document.body.innerHTML = `<input id="test1" class="form-element first"/><input id="test2" class="form-element"/>`;
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(getUniqueClassName(element1)).toBe('first');
    expect(getUniqueClassName(element2)).toBe(null);
  });
});

describe('getLinkText', () => {
  const getLinkText = dom.__get__('getLinkText');

  test('non link element returns null', () => {
    document.body.innerHTML = `<input id="test1" />`;
    const element = document.getElementById('test1');
    expect(getLinkText(element)).toBe(null);
  });

  test('link element without textContent returns null', () => {
    document.body.innerHTML = `<a id="test1"><img src="js.png" /></a>`;
    const element = document.getElementById('test1');
    expect(getLinkText(element)).toBe(null);
  });

  test('link element with textContent', () => {
    document.body.innerHTML = `<a id="test1">Test</a>`;
    const element = document.getElementById('test1');
    expect(getLinkText(element)).toBe('Test');
  });

  test('link element with textContent and whitespace', () => {
    document.body.innerHTML = `<a id="test1"> Test  </a>`;
    const element = document.getElementById('test1');
    expect(getLinkText(element)).toBe('Test');
  });
});

describe('getCssSelector', () => {
  const getCssSelector = dom.__get__('getCssSelector');

  test('simple Simmer selector', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    const element = document.querySelector('p');
    expect(getCssSelector(element)).toBe('P');
  });
});

describe('getLabel', () => {
  const getLabel = dom.__get__('getLabel');

  test('element without label returns null', () => {
    document.body.innerHTML = '<div><input id="test">Paragraph</input></div>';
    const element = document.getElementById('test');
    expect(getLabel(element)).toBe(null);
  });

  test('element with label using for attribute', () => {
    document.body.innerHTML = '<div><label for="test">Forename</label><input id="test" /></div>';
    const element = document.getElementById('test');
    const label = getLabel(element);
    expect(label.textContent).toBe('Forename');
  });

  test('element with wrapped label', () => {
    document.body.innerHTML = '<div><label><span>Forename</span><input id="test" /></label></div>';
    const element = document.getElementById('test');
    const label = getLabel(element);
    expect(label.textContent).toBe('Forename');
  });
});

describe('getNgBinding', () => {
  const getNgBinding = dom.__get__('getNgBinding');

  test('page without angular framework returns null', () => {
    document.body.innerHTML = '<div><input id="test">Paragraph</input></div>';
    const element = document.getElementById('test');
    expect(getNgBinding(element)).toBe(null);
  });

  test('element without ng-binding class returns null', () => {
    // mock the angular $binding
    Object.defineProperty(global, 'angular', {
      value: {
        element() {
          return {
            data() {
              return 'person';
            },
          };
        },
      },
    });
    document.body.innerHTML = '<div><p id="test" >{{person}}</p></div>';
    const element = document.getElementById('test');
    expect(getNgBinding(element)).toBe(null);
  });

  test('element with binding', () => {
    // mock the angular $binding
    Object.defineProperty(global, 'angular', {
      value: {
        element() {
          return {
            data() {
              return 'person';
            },
          };
        },
      },
    });
    document.body.innerHTML = '<div><p id="test" class="ng-binding">{{person}}</p></div>';
    const element = document.getElementById('test');
    expect(getNgBinding(element)).toBe('person');
  });
});

describe('getNgModel', () => {
  const getNgModel = dom.__get__('getNgModel');

  test('test no ng-model attribute returns null', () => {
    document.body.innerHTML = '<div><input id="test" /></div>';
    const element = document.getElementById('test');
    expect(getNgModel(element)).toBe(null);
  });

  test('test ng-model attribute', () => {
    document.body.innerHTML = '<div><input id="test" ng-model="person" /></div>';
    const element = document.getElementById('test');
    expect(getNgModel(element)).toBe('person');
  });

  test('test ng_model attribute', () => {
    document.body.innerHTML = '<div><input id="test" ng_model="employee" /></div>';
    const element = document.getElementById('test');
    expect(getNgModel(element)).toBe('employee');
  });

  test('test data-ng-model attribute', () => {
    document.body.innerHTML = '<div><input id="test" data-ng-model="user" /></div>';
    const element = document.getElementById('test');
    expect(getNgModel(element)).toBe('user');
  });

  test('test x-ng-model attribute', () => {
    document.body.innerHTML = '<div><input id="test" x-ng-model="manager" /></div>';
    const element = document.getElementById('test');
    expect(getNgModel(element)).toBe('manager');
  });

  test('test ng:model attribute', () => {
    document.body.innerHTML = '<div><input id="test" ng:model="forename" /></div>';
    const element = document.getElementById('test');
    expect(getNgModel(element)).toBe('forename');
  });
});

describe('findElementsByXPath', () => {
  const findElementsByXPath = dom.__get__('findElementsByXPath');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    const locator = `//input`;
    expect(findElementsByXPath(document, locator)).toEqual([]);
  });

  test('invalid xpath returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    const locator = `#_input(0)`;
    expect(findElementsByXPath(document, locator)).toEqual([]);
  });

  test('single match', () => {
    document.body.innerHTML = '<div><input id="test1" /></div>';
    const locator = `//input`;
    const element = document.getElementById('test1');
    expect(findElementsByXPath(document, locator)).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<div><input id="test1" /><input id="test2" /></div>';
    const locator = `//input`;
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByXPath(document, locator)).toEqual([element1, element2]);
  });
});

describe('findElementsByCssSelector', () => {
  const findElementsByCssSelector = dom.__get__('findElementsByCssSelector');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    const locator = `input`;
    expect(findElementsByCssSelector(document, locator)).toEqual([]);
  });

  test('invalid selector returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    const locator = `|#_input(0)`;
    expect(findElementsByCssSelector(document, locator)).toEqual([]);
  });

  test('single match', () => {
    document.body.innerHTML = '<div><input id="test1" /></div>';
    const locator = `input`;
    const element = document.getElementById('test1');
    expect(findElementsByCssSelector(document, locator)).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<div><input id="test1" /><input id="test2" /></div>';
    const locator = `input`;
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByCssSelector(document, locator)).toEqual([element1, element2]);
  });
});

describe('findElementsByName', () => {
  const findElementsByName = dom.__get__('findElementsByName');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsByName(document, 'Test')).toEqual([]);
  });

  test('single match', () => {
    document.body.innerHTML = '<div><input id="test1" name="forename" /></div>';
    const element = document.getElementById('test1');
    expect(findElementsByName(document, 'forename')).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<div><input id="test1" name="something" /><input id="test2" name="something" /></div>';
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByName(document, 'something')).toEqual([element1, element2]);
  });
});

describe('findElementsByTagName', () => {
  const findElementsByTagName = dom.__get__('findElementsByTagName');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsByTagName(document, 'span')).toEqual([]);
  });

  test('single match', () => {
    document.body.innerHTML = '<div><input id="test1" name="forename" /></div>';
    const element = document.getElementById('test1');
    expect(findElementsByTagName(document, 'input')).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<div><input id="test1" name="something" /><input id="test2" name="something" /></div>';
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByTagName(document, 'input')).toEqual([element1, element2]);
  });
});

describe('findElementsByClassName', () => {
  const findElementsByClassName = dom.__get__('findElementsByClassName');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsByClassName(document, 'active')).toEqual([]);
  });

  test('single match', () => {
    document.body.innerHTML = '<div><input id="test1" class="active" /></div>';
    const element = document.getElementById('test1');
    expect(findElementsByClassName(document, 'active')).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<div><input id="test1" class="active" /><input id="test2" class="active" /></div>';
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByClassName(document, 'active')).toEqual([element1, element2]);
  });
});

describe('findElementsById', () => {
  const findElementsById = dom.__get__('findElementsById');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsById(document, 'forename')).toEqual([]);
  });

  test('single match', () => {
    document.body.innerHTML = '<div><input id="test1" class="active" /></div>';
    const element = document.getElementById('test1');
    expect(findElementsById(document, 'test1')).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<div><input id="forename" class="test1" /><input id="forename" class="test2" /></div>';
    const element1 = document.getElementsByClassName('test1')[0];
    const element2 = document.getElementsByClassName('test2')[0];
    expect(findElementsById(document, 'forename')).toEqual([element1, element2]);
  });
});

describe('findElementsByLinkText', () => {
  const findElementsByLinkText = dom.__get__('findElementsByLinkText');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsByLinkText(document, 'Paragraph')).toEqual([]);
  });

  test('A element with no text returns empty array', () => {
    document.body.innerHTML = '<div><a id="test1"></a></div>';
    expect(findElementsByLinkText(document, 'Click')).toEqual([]);
  });

  test('Single match', () => {
    document.body.innerHTML = '<div><a id="test1">Click</a></div>';
    const element = document.getElementById('test1');
    expect(findElementsByLinkText(document, 'Click')).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<a id="test1">Click</a><a id="test2">Click</a>';
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByLinkText(document, 'Click')).toEqual([element1, element2]);
  });
});

describe('findElementsByPartialLinkText', () => {
  const findElementsByPartialLinkText = dom.__get__('findElementsByPartialLinkText');

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsByPartialLinkText(document, 'Paragraph')).toEqual([]);
  });

  test('A element with no text returns empty array', () => {
    document.body.innerHTML = '<div><a id="test1"></a></div>';
    expect(findElementsByPartialLinkText(document, 'Click')).toEqual([]);
  });

  test('Single match for full text', () => {
    document.body.innerHTML = '<div><a id="test1">Click</a></div>';
    const element = document.getElementById('test1');
    expect(findElementsByPartialLinkText(document, 'Click')).toEqual([element]);
  });

  test('Single match for partial text', () => {
    document.body.innerHTML = '<div><a id="test1">Click Me</a></div>';
    const element = document.getElementById('test1');
    expect(findElementsByPartialLinkText(document, 'Click')).toEqual([element]);
  });

  test('multiple matches', () => {
    document.body.innerHTML = '<a id="test1">Click Me</a><a id="test2">Click Me Too</a>';
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByPartialLinkText(document, 'Click')).toEqual([element1, element2]);
  });
});

describe('findElementsByTagIndex', () => {
  const findElementsByTagIndex = dom.__get__('findElementsByTagIndex');

  test('invalid locator returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsByTagIndex(document, 'a')).toEqual([]);
  });

  test('no matches returns empty array', () => {
    document.body.innerHTML = '<div><p>Paragraph</p></div>';
    expect(findElementsByTagIndex(document, 'a1')).toEqual([]);
  });

  test('Single match', () => {
    document.body.innerHTML = '<div><a id="test1">Click</a></div>';
    const element = document.getElementById('test1');
    expect(findElementsByTagIndex(document, 'a1')).toEqual([element]);
  });

  test('Multiple matches', () => {
    document.body.innerHTML = '<a id="test1">Click</a><a id="test2">Click</a>';
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByTagIndex(document, 'a1')).toEqual([element1]);
    expect(findElementsByTagIndex(document, 'a2')).toEqual([element2]);
  });
});

describe('findElementsByNgBinding', () => {
  const findElementsByNgBinding = dom.__get__('findElementsByNgBinding');

  test('page without angular framework returns empty array', () => {
    document.body.innerHTML = '<a id="test1" class="ng-binding">Click</a>';
    expect(findElementsByNgBinding(document, 'some.binding')).toEqual([]);
  });

  test('element with ng-binding', () => {
    // mock the angular $binding
    Object.defineProperty(global, 'angular', {
      value: {
        element() {
          return {
            data() {
              return 'person';
            },
          };
        },
      },
    });

    document.body.innerHTML = '<a id="test1" class="ng-binding">Click</a>';
    const element = document.getElementById('test1');
    expect(findElementsByNgBinding(document, 'person')).toEqual([element]);
  });

  test('multiple elements with ng-binding', () => {
    // mock the angular $binding
    Object.defineProperty(global, 'angular', {
      value: {
        element() {
          return {
            data() {
              return 'person';
            },
          };
        },
      },
    });
    document.body.innerHTML = '<a id="test1" class="ng-binding">Click</a><a id="test2" class="ng-binding">Click</a>';
    const element1 = document.getElementById('test1');
    const element2 = document.getElementById('test2');
    expect(findElementsByNgBinding(document, 'person')).toEqual([element1, element2]);
  });
});

describe('findElementsByNgModel', () => {
  const findElementsByNgModel = dom.__get__('findElementsByNgModel');

  test('test no ng-model attribute returns empty array', () => {
    document.body.innerHTML = '<p id="model1">Dan Humphrey</p>';
    expect(findElementsByNgModel(document, 'person')).toEqual([]);
  });

  test('test ng-model attribute', () => {
    document.body.innerHTML = '<p id="model1" ng-model="person">Dan Humphrey</p>';
    const element = document.getElementById('model1');
    expect(findElementsByNgModel(document, 'person')).toEqual([element]);
  });

  test('test ng_model attribute', () => {
    document.body.innerHTML = '<p id="model1" ng_model="person">Dan Humphrey</p>';
    const element = document.getElementById('model1');
    expect(findElementsByNgModel(document, 'person')).toEqual([element]);
  });

  test('test data-ng-model attribute', () => {
    document.body.innerHTML = '<p id="model1" data-ng-model="person">Dan Humphrey</p>';
    const element = document.getElementById('model1');
    expect(findElementsByNgModel(document, 'person')).toEqual([element]);
  });

  test('test x-ng-model attribute', () => {
    document.body.innerHTML = '<p id="model1" x-ng-model="person">Dan Humphrey</p>';
    const element = document.getElementById('model1');
    expect(findElementsByNgModel(document, 'person')).toEqual([element]);
  });

  test('test ng:model attribute', () => {
    document.body.innerHTML = '<p id="model1" ng:model="person">Dan Humphrey</p>';
    const element = document.getElementById('model1');
    expect(findElementsByNgModel(document, 'person')).toEqual([element]);
  });

  test('test multiple matches', () => {
    document.body.innerHTML = '<p id="model1" ng-model="person">Dan Humphrey</p><p id="model2" ng-model="person">Dan Humphrey</p>';
    const element1 = document.getElementById('model1');
    const element2 = document.getElementById('model2');
    expect(findElementsByNgModel(document, 'person')).toEqual([element1, element2]);
  });
});
