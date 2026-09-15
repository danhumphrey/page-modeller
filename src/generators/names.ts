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
/**
 * Also the identifiers the emitter itself occupies, and the two names that are
 * only reserved in strict mode — which a module always is.
 *
 * `page` is the constructor parameter every generated locator reads, so an
 * element called Page produced `const page = page.locator(...)`: a TDZ error
 * that breaks not just its own line but EVERY locator in the file, since they
 * all read `page` afterwards. `constructor` is a parse error in a class body.
 */
const JS_RESERVED_HERE = new Set(['page', 'constructor', 'eval', 'arguments']);

export const jsName = (name: string) =>
  JS_KEYWORDS.has(name) || JS_RESERVED_HERE.has(name) ? `${name}_` : name;

// Java's, for the locators shape, whose fields are bare names. Its methods are
// prefixed (`getContinueElement`) and safe, and C#'s fields carry the .NET
// underscore, which happens to make them safe too.
const JAVA_KEYWORDS = new Set(
  ('abstract assert boolean break byte case catch char class const continue default do double else ' +
    'enum extends final finally float for goto if implements import instanceof int interface long ' +
    'native new package private protected public return short static strictfp super switch ' +
    'synchronized this throw throws transient try void volatile while true false null ' +
    // Restricted and contextual identifiers. They are legal in most positions,
    // which is why they are not in the list above — and every one of them is
    // rejected as a TYPE name. Confirmed against javac rather than the JLS:
    // `public class record {}` answers "'record' not allowed here", and so do
    // sealed, permits, var, yield and the lone underscore.
    'record sealed permits var yield _')
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

/**
 * C#'s reserved words. There is no `csharpName` to go with this: the locators
 * shape gives C# fields the .NET underscore, which makes them safe on their
 * own — but a CLASS name is written bare, so the list is still needed.
 */
const CSHARP_KEYWORDS = new Set(
  ('abstract as base bool break byte case catch char checked class const continue decimal default ' +
    'delegate do double else enum event explicit extern false finally fixed float for foreach goto ' +
    'if implicit in int interface internal is lock long namespace new null object operator out ' +
    'override params private protected public readonly ref return sbyte sealed short sizeof ' +
    'stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ' +
    'ushort using virtual void volatile while')
    .split(' ')
);

/**
 * Reserved in ANY target, for the one identifier that cannot be sanitised
 * behind the user's back: the generated class name (SPEC §17).
 *
 * Element names are made safe per language — `jsName`, `pythonName`,
 * `javaName` each suffix an underscore — because they are derived
 * automatically and nobody should be nagged about a name they did not choose.
 * A class name is typed deliberately, and one name is emitted into all six
 * targets, so `class` has to be refused rather than quietly renamed: it passed
 * the identifier shape check and produced `export class class`,
 * `public class class` and `class class:`, none of which compile.
 */
export const RESERVED_CLASS_NAMES: ReadonlySet<string> = new Set([
  ...JS_KEYWORDS,
  ...PYTHON_KEYWORDS,
  ...JAVA_KEYWORDS,
  ...CSHARP_KEYWORDS,
]);
