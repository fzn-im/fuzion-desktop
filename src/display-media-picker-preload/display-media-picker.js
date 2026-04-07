(function (module) {
  'use strict';

  const ipc = require('./ipc');
  const {
    FUZION_DISPLAY_MEDIA_PICKER_SOURCES,
    FUZION_DISPLAY_MEDIA_PICKER_SELECT,
    FUZION_DISPLAY_MEDIA_PICKER_CANCEL,
  } = require('../main/ipc-channels');

  function onSources (callback) {
    ipc.on(FUZION_DISPLAY_MEDIA_PICKER_SOURCES, (_evt, sources) => {
      callback(sources);
    });
  }

  function offSources (callback) {
    ipc.off(FUZION_DISPLAY_MEDIA_PICKER_SOURCES, callback);
  }

  function selectSource (sourceId) {
    ipc.send(FUZION_DISPLAY_MEDIA_PICKER_SELECT, sourceId);
  }

  function cancel () {
    ipc.send(FUZION_DISPLAY_MEDIA_PICKER_CANCEL);
  }

  module.exports = {
    onSources,
    offSources,
    selectSource,
    cancel,
  };
}).call(this, module);
