/* eslint-disable import/no-extraneous-dependencies */
const fs = require('fs');
const manifest = require('../build-firefox/manifest.json');

(async () => {
  manifest.applications = {
    gecko: {
      id: '{1e34b9b3-8f45-415e-9586-c7d5de0d0aff}',
      strict_min_version: '57.0',
    },
  };

  delete manifest.version_name;
  delete manifest.background.persistent;

  fs.writeFileSync('../build-firefox/manifest.json', JSON.stringify(manifest, null, 2));
})();
