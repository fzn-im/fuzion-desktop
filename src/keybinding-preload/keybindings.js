(function (module) {
  'use strict';

  const ipc = require('./ipc');
  const {
    KEYBINDING_GET_CURRENT,
    KEYBINDING_GET_CURRENT_CALLBACK,
    KEYBINDING_KEYS_ACTIVE,
    FUZION_KEYBINDING_GET_CALLBACK
  } = require('../main/ipc-channels');

  function getCurrentKeybinding() {
    return new Promise((resolve) => {
      ipc.once(KEYBINDING_GET_CURRENT_CALLBACK, (currentKeybinding) => {
        resolve(currentKeybinding)
      });

      ipc.send(KEYBINDING_GET_CURRENT);
    });
  }

  function offKeysActive(callback) {
    ipc.off(KEYBINDING_KEYS_ACTIVE, callback);
  }

  function onKeysActive(callback) {
    ipc.on(KEYBINDING_KEYS_ACTIVE, callback);
  }

  function setKeybinding(keybinding, keys) {
    ipc.send(
      FUZION_KEYBINDING_GET_CALLBACK,
      keybinding,
      keys,
    );
  }

  module.exports = {
    getCurrentKeybinding,
    offKeysActive,
    onKeysActive,
    setKeybinding,
  };
}).call(this, module);
