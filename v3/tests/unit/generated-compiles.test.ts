import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { generateSeleniumJava, generateSeleniumJavaLocators } from '../../src/generators/selenium-java';
import { generateSeleniumCSharp, generateSeleniumCSharpLocators } from '../../src/generators/selenium-csharp';
import { generatePlaywrightPageObject, generatePlaywrightLocators } from '../../src/generators/playwright-ts';
import { generatePuppeteerPageObject, generatePuppeteerLocators } from '../../src/generators/puppeteer';
import { modelOf, everyTypeFor, ALL_BUCKETS } from './fixtures/model';

// Compiling the generated Selenium against the real Selenium API — the only
// check that can tell us GetDomProperty exists, that C# spells it SelectByText
// where Python spells it select_by_visible_text, or that `params string[]` is
// legal there. Everything else about these two targets was reasoned from docs.
//
// Deps come from `npm run fetch:test-deps`, never from `npm test`: the gate has
// to work offline and without a JDK.
const LIB = resolve('tests/compile/lib');
const CSPROJ = resolve('tests/compile/csharp');

const has = (cmd: string, args: string[]) => {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const jars = existsSync(LIB) ? readdirSync(LIB).filter((f) => f.endsWith('.jar')) : [];
const javaReady = has('javac', ['--version']) && jars.length > 0;
const dotnetReady = has('dotnet', ['--version']) && existsSync(join(CSPROJ, 'obj', 'project.assets.json'));

// One model, every bucket: element getter, click, text field, checkbox, radio,
// single select, multi select, static text and an image.
// Every bucket AND every locator type: the buckets decide which methods are
// emitted, the types decide which API calls appear inside them. Miss either and
// the check passes on a subset of the surface.
const model = (id: string) => modelOf(id, ...ALL_BUCKETS, ...everyTypeFor(id));

function fail(what: string, output: string): never {
  throw new Error(`${what} did not compile:\n${output}`);
}

describe.skipIf(!javaReady)('the generated Java compiles against real Selenium', () => {
  it('methods and locators, every bucket', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pm-java-'));
    // Package-private, so several classes can share one file.
    const source = [
      'import java.util.List;',
      'import java.util.stream.Collectors;',
      'import org.openqa.selenium.By;',
      'import org.openqa.selenium.WebDriver;',
      'import org.openqa.selenium.WebElement;',
      'import org.openqa.selenium.support.ui.Select;',
      '',
      'class Methods {',
      '    WebDriver driver;',
      generateSeleniumJava(model('selenium-java')),
      '}',
      '',
      'class Locators {',
      generateSeleniumJavaLocators(model('selenium-java')),
      '}',
    ].join('\n');
    const file = join(dir, 'Generated.java');
    writeFileSync(file, source);

    try {
      execFileSync('javac', ['-cp', jars.map((j) => join(LIB, j)).join(':'), '-d', dir, file], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string };
      fail('Java', `${err.stdout ?? ''}${err.stderr ?? ''}\n\n--- source ---\n${source}`);
    }
    expect(true).toBe(true);
  });
});

describe.skipIf(!dotnetReady)('the generated C# compiles against real Selenium', () => {
  it('methods and locators, every bucket', () => {
    const source = [
      'using System.Collections.Generic;',
      'using System.Linq;',
      'using OpenQA.Selenium;',
      'using OpenQA.Selenium.Support.UI;',
      '',
      'class Methods',
      '{',
      '    IWebDriver driver;',
      generateSeleniumCSharp(model('selenium-csharp')),
      '}',
      '',
      'class Locators',
      '{',
      generateSeleniumCSharpLocators(model('selenium-csharp')),
      '}',
    ].join('\n');
    writeFileSync(join(CSPROJ, 'Generated.cs'), source);

    try {
      execFileSync('dotnet', ['build', '--nologo', '--no-restore', '-v', 'quiet'], {
        cwd: CSPROJ,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string };
      fail('C#', `${err.stdout ?? ''}${err.stderr ?? ''}\n\n--- source ---\n${source}`);
    }
    expect(true).toBe(true);
  }, 120_000);
});

// TypeScript needs no fetch step — tsc, @playwright/test and puppeteer-core are
// already dependencies. This is the primary target, so it is the one place the
// generated code is checked against the real API on every run.
describe('the generated TypeScript typechecks against the real libraries', () => {
  it('page objects and locators, both targets', () => {
    const dir = resolve('tests/compile/ts');
    // Locators-only is a fragment with a free `page`, so it needs a binding to
    // typecheck at all — declared, never assigned, which is enough for tsc.
    const preamble = (module: string, i: number) =>
      [`import { type Page as P${i} } from '${module}';`, `declare const page: P${i};`].join('\n');

    writeFileSync(join(dir, 'pw-page-object.ts'), generatePlaywrightPageObject(model('playwright-ts')));
    writeFileSync(join(dir, 'pw-empty.ts'), generatePlaywrightPageObject(modelOf('playwright-ts')));
    writeFileSync(
      join(dir, 'pw-locators.ts'),
      `${preamble('@playwright/test', 1)}\n${generatePlaywrightLocators(model('playwright-ts'))}\nexport {};`
    );
    writeFileSync(join(dir, 'pup-page-object.ts'), generatePuppeteerPageObject(model('puppeteer')));
    writeFileSync(
      join(dir, 'pup-locators.ts'),
      `${preamble('puppeteer', 2)}\n${generatePuppeteerLocators(model('puppeteer'))}\nexport {};`
    );

    try {
      execFileSync('npx', ['tsc', '-p', join(dir, 'tsconfig.json')], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string };
      fail('TypeScript', `${err.stdout ?? ''}${err.stderr ?? ''}`);
    }
    expect(true).toBe(true);
  }, 120_000);
});

// An environment-gated test that says nothing is an environment-gated test that
// has quietly stopped running.
if (!javaReady || !dotnetReady) {
  it('says which compile checks were skipped', () => {
    const missing = [!javaReady && 'Java', !dotnetReady && 'C#'].filter(Boolean);
    console.warn(`Skipped compile checks: ${missing.join(', ')} — run \`npm run fetch:test-deps\``);
    expect(missing.length).toBeGreaterThan(0);
  });
}
