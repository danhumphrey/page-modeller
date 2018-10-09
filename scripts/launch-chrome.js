const path = require('path');
const launch = require('chrome-launch');

const distPath = path.resolve(process.cwd(), 'build');
const args = [`--load-extension=${distPath}`];

launch('about:blank', { args });
