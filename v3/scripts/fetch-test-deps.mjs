// One-off download for the compile checks (CLAUDE.md, "What is verified per
// target"). Kept out of `npm test` deliberately: the gate must work on a
// machine with no network and no JDK, so those tests skip instead.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const SELENIUM = '4.27.0';
// selenium-api carries By and WebElement, selenium-support carries Select.
// The `selenium-java` artifact is only a POM, so it has no classes to compile
// against.
const JARS = ['selenium-api', 'selenium-support'];
const LIB = resolve('tests/compile/lib');

mkdirSync(LIB, { recursive: true });

let ok = true;
for (const artifact of JARS) {
  const file = resolve(LIB, `${artifact}-${SELENIUM}.jar`);
  if (existsSync(file)) {
    console.log(`✓ ${artifact} already here`);
    continue;
  }
  const url = `https://repo1.maven.org/maven2/org/seleniumhq/selenium/${artifact}/${SELENIUM}/${artifact}-${SELENIUM}.jar`;
  process.stdout.write(`… ${artifact} `);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log('ok');
  } catch (e) {
    ok = false;
    console.log(`FAILED: ${e.message}`);
  }
}

try {
  execFileSync('dotnet', ['restore'], { cwd: resolve('tests/compile/csharp'), stdio: 'inherit' });
  console.log('✓ Selenium NuGet packages restored');
} catch {
  ok = false;
  console.log('dotnet restore failed — is the .NET SDK installed?');
}

console.log(ok ? '\nCompile checks are ready. Run npm test.' : '\nSome deps are missing; those checks will skip.');
