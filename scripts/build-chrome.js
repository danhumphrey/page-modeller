#!/usr/bin/env node
/* eslint-disable import/no-extraneous-dependencies */
const fs = require('fs');
const path = require('path');
const zipFolder = require('zip-folder');
const extPackageJson = require('../package.json');

const DEST_DIR = path.join(__dirname, '../dist');
const DEST_ZIP_DIR = path.join(__dirname, '../release-chrome');

const extractExtensionData = () => ({
  name: extPackageJson.name,
  version: extPackageJson.version,
});

const makeDestZipDirIfNotExists = () => {
  if (!fs.existsSync(DEST_ZIP_DIR)) {
    fs.mkdirSync(DEST_ZIP_DIR);
  }
};

const buildZip = (src, dist, zipFilename) => {
  console.info(`Building ${zipFilename}...`);

  return new Promise((resolve, reject) => {
    zipFolder(src, path.join(dist, zipFilename), err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const main = () => {
  const { name, version } = extractExtensionData();
  const zipFilename = `${name}-v${version}.zip`;

  makeDestZipDirIfNotExists();

  buildZip(DEST_DIR, DEST_ZIP_DIR, zipFilename)
    .then(() => console.info('OK'))
    .catch(console.err);
};

main();
