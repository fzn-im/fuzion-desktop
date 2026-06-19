'use strict';

const {
  resolveApplicationLoopbackDeviceId,
} = require('../native/win-app-audio');

// Mirrors renderer audio.restrictOwnAudio: true on Electron Windows.
const RESTRICT_OWN_AUDIO = true;

// Electron setDisplayMediaRequestHandler accepts custom audio device ids via
// { id, name } — same escape hatch Chromium uses internally. See:
// https://github.com/electron/electron/blob/v41.1.1/shell/browser/electron_browser_context.cc
const LOOPBACK_WITHOUT_CHROME = {
  id: 'loopbackWithoutChrome',
  name: 'System audio',
};

/**
 * @param {{ source: { id: string, name: string }, audioRequested: boolean, includeApplicationAudio?: boolean }} opts
 * @returns {{ video: { id: string, name: string }, audio?: string | { id: string, name: string } }}
 */
function buildDisplayMediaStreams({ source, audioRequested, includeApplicationAudio = true }) {
  const streams = {
    video: { id: source.id, name: source.name },
  };

  if (!audioRequested) {
    return streams;
  }

  if (process.platform === 'linux') {
    streams.audio = 'loopback';
    return streams;
  }

  if (process.platform !== 'win32') {
    return streams;
  }

  if (source.id.startsWith('screen:')) {
    streams.audio = RESTRICT_OWN_AUDIO ? LOOPBACK_WITHOUT_CHROME : 'loopback';
    return streams;
  }

  if (source.id.startsWith('window:')) {
    if (!includeApplicationAudio) {
      return streams;
    }

    const deviceId = resolveApplicationLoopbackDeviceId(source.id, {
      restrictOwnAudio: RESTRICT_OWN_AUDIO,
    });

    if (deviceId) {
      streams.audio = { id: deviceId, name: 'Application audio' };
    } else {
      console.warn(
        'display-media: could not resolve application loopback for window',
        source.id,
      );
    }

    return streams;
  }

  return streams;
}

module.exports = {
  buildDisplayMediaStreams,
};
