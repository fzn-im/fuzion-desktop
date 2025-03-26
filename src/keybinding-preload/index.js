(function preload (require) {
  'use strict';
  
  // avoid prototype, they evil

  const { contextBridge } = require('electron');

  const keybindings = require('./keybindings');

  contextBridge.exposeInMainWorld('keybindings', keybindings);
}).call(this, require);
