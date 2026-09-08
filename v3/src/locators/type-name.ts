// The type suffix appended to a derived name when `appendTypeToName` is on
// (SPEC §13): `DiscoverTheDifference` → `DiscoverTheDifferenceLink`.
//
// Test-author vocabulary rather than raw ARIA: `textbox` becomes `Input` and
// `combobox` becomes `Select`, because those are the words people use when
// naming page-object members, and the names are read by testers rather than
// accessibility folk. Roles with no entry fall back to the role itself, so an
// unmapped role still produces something sensible.
const SUFFIX: Record<string, string> = {
  link: 'Link',
  button: 'Button',
  textbox: 'Input',
  searchbox: 'Input',
  spinbutton: 'Input',
  combobox: 'Select',
  listbox: 'Select',
  checkbox: 'Checkbox',
  radio: 'Radio',
  switch: 'Switch',
  img: 'Image',
  heading: 'Heading',
  tab: 'Tab',
  menuitem: 'MenuItem',
  option: 'Option',
};

function pascal(role: string): string {
  return role
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

/** The suffix for a role, or '' when there is no role to describe. */
export function typeSuffix(role: string | null): string {
  if (!role) return '';
  return SUFFIX[role] ?? pascal(role);
}

/** `About` + link → `AboutLink`. Already-suffixed names are left alone. */
export function withTypeSuffix(name: string, role: string | null): string {
  const suffix = typeSuffix(role);
  if (!suffix || name.toLowerCase().endsWith(suffix.toLowerCase())) return name;
  return `${name}${suffix}`;
}
