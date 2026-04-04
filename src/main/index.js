const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  systemPreferences,
} = require('electron');
const { fork } = require('child_process');

const FuzionElectron = require('./fuzion-electron');
const { attachContextMenu } = require('./context-menu');

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

  // getDisplayMedia: in Electron this must be satisfied via desktopCapturer, not only permissions.
  s.setDisplayMediaRequestHandler((request, callback) => {
    void desktopCapturer
      .getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      })
      .then((sources) => {
        if (sources.length === 0) {
          callback({});
          return;
        }

        const maxButtons = 24;
        const screens = sources.filter((src) => src.id.startsWith('screen:'));
        const wins = sources.filter((src) => src.id.startsWith('window:'));
        const ordered = [...screens, ...wins ].slice(0, maxButtons);

        const parent =
          BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

        const pick = (src) => {
          const streams = {
            video: { id: src.id, name: src.name },
          };

          if (request.audioRequested && process.platform === 'win32') {
            streams.audio = 'loopback';
          }

          callback(streams);
        };

        if (ordered.length === 1) {
          pick(ordered[0]);
          return;
        }

        const labels = ordered.map((src) => {
          const n = src.name.trim() || src.id;
          return n.length > 48 ? `${n.slice(0, 45)}…` : n;
        });
        const cancelId = labels.length;

        void dialog
          .showMessageBox(parent ?? undefined, {
            type: 'question',
            title: 'Share screen',
            message: 'Choose a screen or window to share.',
            buttons: [ ...labels, 'Cancel' ],
            cancelId,
            defaultId: 0,
          })
          .then(({ response }) => {
            if (response < 0 || response >= ordered.length) {
              callback({});
              return;
            }
            pick(ordered[response]);
          });
      })
      .catch(() => {
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
