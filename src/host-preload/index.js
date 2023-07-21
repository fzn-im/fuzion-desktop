(function preload(require) {
  'use strict';

  // avoid prototype, they evil

  const { contextBridge, ipcRenderer } = require('electron');
  const { platform } = require('process');

  const { version } = require('../../package.json');
  const { getBuildPath } = require('../utils/path');

  const handleNewWebView = () => {
    ipcRenderer.send('FUZION_NEW_WEBVIEW');
  };

  const FuzionElectron = {
    platform,
    version,
  };

  // avoid prototype, they evil
  contextBridge.exposeInMainWorld(
    '__buildPath',
    getBuildPath(),
  );
  contextBridge.exposeInMainWorld('handleNewWebView', handleNewWebView);
  contextBridge.exposeInMainWorld('fuzionElectron', FuzionElectron);
}).call(this, require);
