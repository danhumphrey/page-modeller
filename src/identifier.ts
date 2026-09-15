/**
 * Whether a name can be an identifier in every target we generate.
 *
 * The derived names are safe by construction — `naming.ts` PascalCases them
 * and fixes a leading digit — but renaming is a first-class flow (SPEC §9) and
 * so is overriding the class name (SPEC §12), and neither was checked. The
 * output is pasted into someone's test suite, so a name that cannot be an
 * identifier is a file that does not compile:
 *
 *   `Sign-In`  → java `public WebElement getSign-InElement()`
 *                c#   `Get-Sign-InElement`
 *                ts   `readonly sign-In: Locator;`
 *   `My Page`  → `public class My Page {`
 *   `2fa`      → `readonly 2fa: Locator;`
 *
 * Python survived only because `snake()` silently drops the junk, which is
 * worse rather than better: the same model produced a working file in one
 * language and a broken one in four.
 *
 * ASCII letters, digits and underscore, not starting with a digit. Deliberately
 * narrower than any single language allows — Java and C# accept most Unicode
 * letters, TypeScript nearly as many — because the name has to work in all
 * five at once, and because a name nobody can type is a poor one anyway.
 */
import { RESERVED_CLASS_NAMES } from './generators/names';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function identifierError(value: string, what: 'Name' | 'Class name'): string {
  const trimmed = value.trim();
  if (!trimmed) return `${what} is required.`;
  if (/\s/.test(trimmed)) return `${what} cannot contain spaces.`;
  if (/^[0-9]/.test(trimmed)) return `${what} cannot start with a digit.`;
  if (!IDENTIFIER.test(trimmed)) return `${what} can only use letters, digits and underscores.`;
  // Only for a class name. An element called `class` is renamed per language on
  // the way out — `jsName` and friends suffix an underscore — because those
  // names are derived and nobody should be nagged about one they did not
  // choose. The class name is typed on purpose and one name is emitted into
  // all six targets, so refusing it is clearer than silently shipping
  // `export class class_`.
  if (what === 'Class name' && RESERVED_CLASS_NAMES.has(trimmed)) {
    return `${what} cannot be a reserved word in any target language.`;
  }
  return '';
}
