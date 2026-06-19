'use strict';

let native = null;

if (process.platform === 'win32') {
  try {
    native = require('./build/Release/win_app_audio.node');
  } catch (err) {
    console.warn('win-app-audio: native module not loaded', err.message);
  }
}

function getCurrentProcessId() {
  if (native) {
    return native.getCurrentProcessId();
  }
  return process.pid;
}

function resolveApplicationLoopbackDeviceId(desktopCapturerSourceId, options = {}) {
  if (!native) {
    return null;
  }
  return native.resolveApplicationLoopbackDeviceId(desktopCapturerSourceId, options);
}

function isOwnApplicationWindow(desktopCapturerSourceId) {
  if (!native) {
    return false;
  }
  return native.isOwnApplicationWindow(desktopCapturerSourceId);
}

module.exports = {
  getCurrentProcessId,
  resolveApplicationLoopbackDeviceId,
  isOwnApplicationWindow,
};
