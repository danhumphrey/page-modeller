/* eslint-disable import/no-extraneous-dependencies */
const fs = require('fs');
const inquirer = require('inquirer');
const semver = require('semver');
const pkg = require('../package.json');
const manifest = require('../src/manifest.json');
const versionFile = require('../version');

const curVersion = pkg.version;

(async () => {
  const { newVersion } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newVersion',
      message: `Please provide a version (current: ${curVersion}):`,
    },
  ]);

  if (!semver.valid(newVersion)) {
    console.error(`Invalid version: ${newVersion}`);
    process.exit(1);
  }

  if (semver.lt(newVersion, curVersion)) {
    console.error(`New version (${newVersion}) cannot be lower than current version (${curVersion}).`);
    process.exit(1);
  }

  const { yes } = await inquirer.prompt([
    {
      name: 'yes',
      message: `Release ${newVersion}?`,
      type: 'confirm',
    },
  ]);

  const updateReadme = v => {
    // update README
    fs.readFile('../README.md', 'utf8', (readError, data) => {
      if (readError) {
        console.error(readError);
        return process.exit(1);
      }
      const result = data.replace(/Current release: \*\*(.*)\*\*/g, `Current release: **${v}**`);

      return fs.writeFile('../README.md', result, 'utf8', writeError => {
        if (writeError) {
          console.error(writeError);
          return process.exit(1);
        }
        return true;
      });
    });
  };

  const updatePopup = v => {
    // update README
    fs.readFile('../src/popup/App.vue', 'utf8', (readError, data) => {
      if (readError) {
        console.error(readError);
        return process.exit(1);
      }
      const result = data.replace(/version: '(.*)'/g, `version: '${v}'`);

      return fs.writeFile('../src/popup/App.vue', result, 'utf8', writeError => {
        if (writeError) {
          console.error(writeError);
          return process.exit(1);
        }
        return true;
      });
    });
  };

  if (yes) {
    const isBeta = newVersion.includes('beta');
    pkg.version = newVersion;
    if (isBeta) {
      const [, baseVersion, betaVersion] = /(.*)-beta\.(\w+)/.exec(newVersion);
      manifest.version = `${baseVersion}.${betaVersion}`;
      manifest.version_name = `${baseVersion} beta ${betaVersion}`;
      versionFile.version = baseVersion;
      updateReadme(baseVersion);
      updatePopup(baseVersion);
    } else {
      manifest.version = newVersion;
      manifest.version_name = newVersion;
      versionFile.version = newVersion;
      updateReadme(newVersion);
      updatePopup(newVersion);
    }

    fs.writeFileSync('../package.json', JSON.stringify(pkg, null, 2));
    fs.writeFileSync('../src/manifest.json', JSON.stringify(manifest, null, 2));
    fs.writeFileSync('../version.json', JSON.stringify(versionFile, null, 2));
  } else {
    process.exit(1);
  }
})();
