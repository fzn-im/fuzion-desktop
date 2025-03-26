(function preload (require) {
  'use strict';
  
  // avoid prototype, they evil

  const { contextBridge } = require('electron');
  const { platform } = require('process');

  const { version } = require('../../package.json');

  const ipc = require('./ipc');
  const keybindings = require('./keybindings');

  const FuzionElectron = {
    ipc,
    keybindings,
    platform,
    version,
  };

  contextBridge.exposeInMainWorld('fuzionElectron', FuzionElectron);
}).call(this, require);
