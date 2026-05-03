const {
  app,
  BrowserWindow,
  desktopCapturer,
  systemPreferences,
} = require('electron');
const { fork } = require('child_process');

const FuzionElectron = require('./fuzion-electron');
const { attachContextMenu } = require('./context-menu');
const { openDisplayMediaPickerWindow } = require('./display-media-picker-window');

/** Linux (PipeWire/Wayland): desktopCapturer often exposes one stub source; use Chromium/portal picker instead. */
const useLinuxSystemDisplayPicker =
  process.platform === 'linux' &&
  process.env.FUZION_CUSTOM_DISPLAY_MEDIA_PICKER !== '1';

// Optional: can help Wayland screen capture but often breaks mic / voice WebRTC on Linux.
if (process.platform === 'linux' && process.env.FUZION_PIPEWIRE_SCREEN_CAPTURE === '1') {
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
}

const configuredSessions = new WeakSet();

function attachSessionMediaHandlers(s) {
  if (configuredSessions.has(s)) {
    return;
  }
  configuredSessions.add(s);

  // getUserMedia (voice): grant without a custom check handler so Chromium keeps normal behavior.
  s.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'openExternal') {
      callback(false);
      return;
    }
    callback(true);
  });

  // getDisplayMedia: custom picker on win32/darwin; Linux uses default handler so xdg-desktop-portal / system UI can run.
  s.setDisplayMediaRequestHandler((request, callback) => {
    console.log('[display-media] handler entered', {
      platform: process.platform,
      videoRequested: request.videoRequested,
      audioRequested: request.audioRequested,
      useLinuxSystemDisplayPicker,
    });

    void desktopCapturer
      .getSources({
        types: ['screen', 'window'],
        thumbnailSize: useLinuxSystemDisplayPicker
          ? { width: 0, height: 0 }
          : { width: 320, height: 180 },
        fetchWindowIcons: false,
      })
      .then((sources) => {
        if (sources.length === 0) {
          console.error('[display-media] no sources available', {
            platform: process.platform,
            hint: process.platform === 'win32'
              ? 'Often: screen-recording permission, secure desktop (UAC), or capturer blocked.'
              : undefined,
          });
          callback({});
          return;
        }

        const maxItems = 36;
        const screens = sources.filter((src) => src.id.startsWith('screen:'));
        const wins = sources.filter((src) => src.id.startsWith('window:'));
        const ordered = [ ...screens, ...wins ].slice(0, maxItems);

        console.log('[display-media] sources', {
          total: sources.length,
          screenCount: screens.length,
          windowCount: wins.length,
          orderedCount: ordered.length,
        });
        console.debug('[display-media] source ids', sources.map((s) => s.id));

        const pick = (src) => {
          const streams = {
            video: { id: src.id, name: src.name },
          };

          if (request.audioRequested && process.platform === 'win32') {
            streams.audio = 'loopback';
          }

          callback(streams);
        };

        if (ordered.length === 0) {
          console.error('[display-media] no screen:/window: sources after filter', {
            platform: process.platform,
            rawIds: sources.map((s) => s.id),
          });
          callback({});
          return;
        }

        if (useLinuxSystemDisplayPicker) {
          const src = ordered[0];
          console.log('[display-media] linux portal auto-pick', {
            reason: 'linux-portal',
            id: src.id,
            name: src.name,
          });
          pick(src);
          return;
        }

        console.log('[display-media] opening custom picker', { count: ordered.length });
        openDisplayMediaPickerWindow({
          rawSources: ordered,
          request,
          callback,
        });
      })
      .catch((err) => {
        console.error('[display-media] getSources threw', err);
        callback({});
      });
  });
}

app.on('web-contents-created', (_event, contents) => {
  attachSessionMediaHandlers(contents.session);
  attachContextMenu(contents);
});

const instanceLock = app.requestSingleInstanceLock();

if (!instanceLock) {
  app.quit();
  process.exit(0);
}

let iohook;
let iohookRestart = true;

app.on('ready', () => {
  global.fuzionElectron = new FuzionElectron();

  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) {
    global.fuzionElectron.mainWindow.window.on('show', () => {
      setTimeout(() => handleIoHookInit(true), 2000);
    });
  } else {
    handleIoHookInit(true);
  }
});

app.on('certificate-error', (evt, _webContents, _url, _error, _certificate, callback) => {
  evt.preventDefault();

  callback(true);
});

let darwinAccessibilityCheckInterval;
function handleIoHookInit(prompt = false) {
  if (!iohookRestart) {
    return;
  }

  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(prompt)) {
    if (process.platform === 'darwin' && !darwinAccessibilityCheckInterval) {
      darwinAccessibilityCheckInterval = setInterval(handleIoHookInit, 2000);
    }

    return;
  }

  clearInterval(darwinAccessibilityCheckInterval);

  if (process.platform === 'win32') {
    iohook = fork(`${__dirname}/iohook-fork.js`, [], {
      stdio: [0, 1, 2, 'ipc'],
    });

    global.fuzionElectron.setIohookWin32(iohook);
  } else {
    iohook = require('iohook');

    // iohook.start(true);
    iohook.start(false);

    global.fuzionElectron.setIohook(iohook);
  }
}

app.on('before-quit', () => {
  if (iohook) {
    iohookRestart = false;

    if (process.platform === 'win32') {
      iohook.kill();
    } else {
      iohook.unload();
      iohook.stop();
      process.exit(0); // iohook hangs
    }
  }
});
