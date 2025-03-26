(function (module) {
  'use strict';

  const ipc = require('./ipc');

  const KEYBINDINGS_SET = 'KEYBINDINGS_SET';
  const KEYBINDING_SET = 'KEYBINDING_SET';
  const KEYBINDING_REMOVE = 'KEYBINDING_REMOVE';
  const KEYBINDINGS_RESET = 'KEYBINDINGS_RESET';
  const KEYBINDING_ACTION_UPDATE = 'KEYBINDING_ACTION_UPDATE';
  const KEYBINDING_GET = 'KEYBINDING_GET';
  const KEYBINDING_GET_CALLBACK = 'KEYBINDING_GET_CALLBACK';
  const KEYBINDING_CANCEL_GET = 'KEYBINDING_CANCEL_GET';
  const KEYBINDING_GET_CLOSED = 'KEYBINDING_GET_CLOSED';

  function setKeybindings(keybindings) {
    ipc.send(KEYBINDINGS_SET, keybindings);
  }
  
  let onGetKeybindingCallback = null;
  function getKeybinding(keybinding, currentKeys, callback) {
    ipc.send(KEYBINDING_GET, keybinding, currentKeys);

    if (onGetKeybindingCallback) {
      ipc.off(KEYBINDING_GET_CALLBACK, onGetKeybindingCallback);
    }

    if (callback) {
      onGetKeybindingCallback = callback;

      ipc.once(KEYBINDING_GET_CALLBACK, onGetKeybindingCallback);
    }
  }
  
  function cancelGetKeybinding() {
    ipc.send(KEYBINDING_CANCEL_GET);
  }

  function setKeybinding(keybinding) {
    ipc.send(KEYBINDING_SET, keybinding);
  }

  function removeKeybinding(keybinding) {
    ipc.send(KEYBINDING_REMOVE, keybinding);
  }

  function resetKeybindings() {
    ipc.send(KEYBINDINGS_RESET);
  }

  function onKeybindingActionUpdate(callback) {
    ipc.on(KEYBINDING_ACTION_UPDATE, callback);
  }

  function offKeybindingActionUpdate(callback) {
    ipc.off(KEYBINDING_ACTION_UPDATE, callback);
  }

  function onGetKeybindingClose(callback) {
    ipc.on(KEYBINDING_GET_CLOSED, callback);
  }

  function offGetKeybindingClose(callback) {
    ipc.off(KEYBINDING_GET_CLOSED, callback);
  }

  module.exports = {
    onKeybindingActionUpdate,
    offKeybindingActionUpdate,
    setKeybindings,
    getKeybinding,
    cancelGetKeybinding,
    offGetKeybindingClose,
    onGetKeybindingClose,
    setKeybinding,
    removeKeybinding,
    resetKeybindings,
  };
}).call(this, module);
