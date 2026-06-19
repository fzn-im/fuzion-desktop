'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

if (process.platform !== 'win32') {
  process.exit(0);
}

const addonDir = path.join(__dirname, '../src/native/win-app-audio');
const electronVersion = require('../package.json').devDependencies.electron.replace(/[^\d.]/g, '');

const npmEnv = {
  ...process.env,
  npm_config_target: electronVersion,
  npm_config_runtime: 'electron',
  npm_config_disturl: 'https://electronjs.org/headers',
  npm_config_build_from_source: 'true',
};

const install = spawnSync('npm', ['install', '--no-save'], {
  cwd: addonDir,
  env: npmEnv,
  stdio: 'inherit',
  shell: true,
});

if (install.status !== 0) {
  console.warn('win-app-audio: native build failed (window application audio will be unavailable)');
  process.exit(0);
}

const rebuild = spawnSync('npx', ['node-gyp', 'rebuild'], {
  cwd: addonDir,
  env: npmEnv,
  stdio: 'inherit',
  shell: true,
});

if (rebuild.status !== 0) {
  console.warn('win-app-audio: native rebuild failed (window application audio will be unavailable)');
}
