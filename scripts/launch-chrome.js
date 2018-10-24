const path = require('path');
const launch = require('chrome-launch');
const pkg = require('../package');

const distPath = path.resolve(process.cwd(), 'build');
const args = [`--load-extension=${distPath}`, '--auto-open-devtools-for-tabs'];

launch(pkg.homepage, { args });
