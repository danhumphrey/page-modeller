// Element names are PascalCase (engine/naming.ts), which suits a method suffix
// — `getEmailAddressElement`. As a variable or field, most languages want
// lower-camel.
export function lowerCamel(name: string): string {
  return name[0].toLowerCase() + name.slice(1);
}
