(function (module) {
  'use strict';

  const ipc = require('electron').ipcRenderer;
  const { SanitizedIpc } = require('../utils/sanitized-ipc');

  const sanitizedIpc = new SanitizedIpc();

  function send(event, ...args) {
    ipc.send(event, ...args);
  }

  function on(event, callback) {
    ipc.on(event, sanitizedIpc.getOr(callback));
  }

  function once(event, callback) {
    ipc.once(event, sanitizedIpc.getOr(callback));
  }

  function off(event, callback) {
    ipc.removeListener(event, sanitizedIpc.getOr(callback));
  }

  module.exports = {
    send,
    on,
    once,
    off,
  };
}).call(this, module);
