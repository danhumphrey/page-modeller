// Element names are PascalCase (engine/naming.ts), which suits a Java or C#
// method suffix — `getEmailAddressElement`. Every other position wants a
// different case, and each language has its own opinion about which.

/** Split a PascalCase name into lowercase words. `URLField` → `url`, `field`. */
function words(name: string): string[] {
  // The first alternative takes a run of capitals that is NOT the start of a
  // new word — an acronym — so `URLField` does not become `u_r_l_field`.
  return name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z0-9]+|[0-9]+/g)?.map((w) => w.toLowerCase()) ?? [name.toLowerCase()];
}

/** TypeScript and Java fields, JavaScript variables. */
export function lowerCamel(name: string): string {
  return name[0].toLowerCase() + name.slice(1);
}

/** C# private fields, by .NET convention. */
export function underscoreCamel(name: string): string {
  return `_${lowerCamel(name)}`;
}

/** Python functions and attributes (PEP 8). */
export function snake(name: string): string {
  return words(name).join('_');
}

/** Python module-level constants, which is what a locator tuple is (PEP 8). */
export function upperSnake(name: string): string {
  return snake(name).toUpperCase();
}
