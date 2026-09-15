import { describe, it, expect } from 'vitest';
import { typeSuffix, withTypeSuffix } from '../../src/locators/type-name';

describe('typeSuffix', () => {
  it('uses test-author vocabulary, not raw ARIA', () => {
    // These names are read by testers writing page objects, not by people
    // working on accessibility.
    expect(typeSuffix('textbox')).toBe('Input');
    expect(typeSuffix('searchbox')).toBe('Input');
    expect(typeSuffix('combobox')).toBe('Select');
    expect(typeSuffix('listbox')).toBe('Select');
    expect(typeSuffix('img')).toBe('Image');
  });

  it('passes through roles that already read well', () => {
    expect(typeSuffix('link')).toBe('Link');
    expect(typeSuffix('button')).toBe('Button');
    expect(typeSuffix('checkbox')).toBe('Checkbox');
  });

  it('falls back to the role itself when unmapped', () => {
    // An unmapped role still produces something sensible rather than nothing.
    expect(typeSuffix('treeitem')).toBe('Treeitem');
    expect(typeSuffix('menuitemcheckbox')).toBe('Menuitemcheckbox');
  });

  it('has nothing to say about an element with no role', () => {
    expect(typeSuffix(null)).toBe('');
  });
});

describe('withTypeSuffix', () => {
  it('appends the type', () => {
    expect(withTypeSuffix('DiscoverTheDifference', 'link')).toBe('DiscoverTheDifferenceLink');
    expect(withTypeSuffix('Search', 'textbox')).toBe('SearchInput');
  });

  it('leaves a name that already ends in its type alone', () => {
    // Otherwise "Log in" on a button becomes LogInButtonButton.
    expect(withTypeSuffix('SubmitButton', 'button')).toBe('SubmitButton');
    expect(withTypeSuffix('Submitbutton', 'button')).toBe('Submitbutton');
  });

  it('leaves a name alone when there is no role', () => {
    expect(withTypeSuffix('Div1', null)).toBe('Div1');
  });
});
