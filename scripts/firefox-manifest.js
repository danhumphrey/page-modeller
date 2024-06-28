/* eslint-disable import/no-extraneous-dependencies */
const fs = require('fs');
const manifest = require('../build-firefox/manifest.json');

(async () => {
  delete manifest.version_name;
  delete manifest.background.persistent;
  delete manifest.background.service_worker;
  manifest.background.scripts = ['background.js'];
  fs.writeFileSync('../build-firefox/manifest.json', JSON.stringify(manifest, null, 2));
})();
