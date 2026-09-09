// String literals, for every language we generate.
//
// JavaScript, TypeScript, Java, C# and Python happen to agree on the escapes
// that matter — a doubled backslash, the quote character, \n, \r, \t and
// \uXXXX — so one implementation serves all five. Five near-copies is how one
// of them ends up escaping less than the others.
//
// The newline is the one that bites: values reach here from the Edit dialog as
// well as the engine, and a literal newline inside a single-line string is a
// syntax error in all five languages.
function body(value: string, quote: string): string {
  return (
    value
      .replace(/\\/g, '\\\\')
      .split(quote)
      .join(`\\${quote}`)
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      // Anything else non-printable, spelled the way all five understand.
      .replace(/[\u0000-\u001f\u007f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  );
}

export const singleQuoted = (value: string) => `'${body(value, "'")}'`;
export const doubleQuoted = (value: string) => `"${body(value, '"')}"`;
