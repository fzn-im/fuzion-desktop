(function preload (require) {
  'use strict';

  const { contextBridge } = require('electron');

  const displayMediaPicker = require('./display-media-picker');

  contextBridge.exposeInMainWorld('displayMediaPicker', displayMediaPicker);
}).call(this, require);
