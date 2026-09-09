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

/**
 * Element names come from the page, and pages contain buttons called Continue,
 * Class and Import. Those are keywords, and a keyword cannot be an identifier.
 *
 * A trailing underscore is what PEP 8 prescribes for exactly this, and it reads
 * the same way in JavaScript. Better than dropping or renaming: the name still
 * says which element it is.
 */
const PYTHON_KEYWORDS = new Set(
  ('False None True and as assert async await break class continue def del elif else except finally ' +
    'for from global if import in is lambda nonlocal not or pass raise return try while with yield')
    .split(' ')
);

// Reserved words that cannot be a `const` binding. Property names may be
// keywords in JavaScript, but the locators shape declares variables.
const JS_KEYWORDS = new Set(
  ('await break case catch class const continue debugger default delete do else enum export extends ' +
    'false finally for function if implements import in instanceof interface let new null package ' +
    'private protected public return static super switch this throw true try typeof var void while ' +
    'with yield')
    .split(' ')
);

export const pythonName = (name: string) => (PYTHON_KEYWORDS.has(name) ? `${name}_` : name);
export const jsName = (name: string) => (JS_KEYWORDS.has(name) ? `${name}_` : name);

// Java's, for the locators shape, whose fields are bare names. Its methods are
// prefixed (`getContinueElement`) and safe, and C#'s fields carry the .NET
// underscore, which happens to make them safe too.
const JAVA_KEYWORDS = new Set(
  ('abstract assert boolean break byte case catch char class const continue default do double else ' +
    'enum extends final finally float for goto if implements import instanceof int interface long ' +
    'native new package private protected public return short static strictfp super switch ' +
    'synchronized this throw throws transient try void volatile while true false null')
    .split(' ')
);

export const javaName = (name: string) => (JAVA_KEYWORDS.has(name) ? `${name}_` : name);

/**
 * Every method `java.lang.Object` already has. An element called Class yields
 * `getClass()`, which cannot be declared — it does not override cleanly, and
 * javac says so. Found by adding such a name to the compile fixtures.
 */
const OBJECT_METHODS = new Set(['getClass', 'hashCode', 'equals', 'toString', 'notify', 'notifyAll', 'wait', 'clone', 'finalize']);

export const javaMethod = (name: string) => (OBJECT_METHODS.has(name) ? `${name}_` : name);
