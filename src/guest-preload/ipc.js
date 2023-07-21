(function (module) {
  'use strict';

  const ipc = require('electron').ipcRenderer;
  const { SanitizedIpc } = require('../utils/sanitized-ipc');

  const sanitizedIpc = new SanitizedIpc();

  function send(event, ...args) {
    ipc.send(`FUZION_${event}`, ...args);
  }

  function on(event, callback) {
    ipc.on(`FUZION_${event}`, sanitizedIpc.getOr(callback));
  }

  function once(event, callback) {
    ipc.once(`FUZION_${event}`, sanitizedIpc.getOr(callback));
  }

  function off(event, callback) {
    ipc.removeListener(`FUZION_${event}`, sanitizedIpc.getOr(callback));
  }

  module.exports = {
    send,
    on,
    once,
    off,
  };
}).call(this, module);
