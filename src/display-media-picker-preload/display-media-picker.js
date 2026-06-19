(function (module) {
  'use strict';

  const ipc = require('./ipc');
  const {
    FUZION_DISPLAY_MEDIA_PICKER_SOURCES,
    FUZION_DISPLAY_MEDIA_PICKER_SELECT,
    FUZION_DISPLAY_MEDIA_PICKER_CANCEL,
  } = require('../main/ipc-channels');

  const subscribers = [];
  let lastSources = null;

  // SanitizedIpc strips the ipc event; this callback receives only the payload
  // (one argument). Do not use (_evt, sources) or `sources` is always undefined.
  ipc.on(FUZION_DISPLAY_MEDIA_PICKER_SOURCES, (sources) => {
    lastSources = Array.isArray(sources) ? sources : [];
    subscribers.forEach((cb) => {
      cb(lastSources);
    });
  });

  function onSources(callback) {
    subscribers.push(callback);

    if (lastSources !== null) {
      queueMicrotask(() => {
        callback(lastSources);
      });
    }
  }

  function offSources(callback) {
    const i = subscribers.indexOf(callback);
    if (i !== -1) {
      subscribers.splice(i, 1);
    }
  }

  function selectSource(sourceId, includeAudio = true) {
    ipc.send(FUZION_DISPLAY_MEDIA_PICKER_SELECT, { sourceId, includeAudio });
  }

  function cancel() {
    ipc.send(FUZION_DISPLAY_MEDIA_PICKER_CANCEL);
  }

  module.exports = {
    onSources,
    offSources,
    selectSource,
    cancel,
  };
}).call(this, module);
