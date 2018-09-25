const path = require('path');
const launch = require('chrome-launch');

const distPath = path.resolve(process.cwd(), 'dist');
const args = [`--load-extension=${distPath}`];

launch('about:blank', { args });
