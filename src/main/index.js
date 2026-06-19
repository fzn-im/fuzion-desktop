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
const { buildDisplayMediaStreams } = require('./display-media-streams');

/** Linux (PipeWire/Wayland): desktopCapturer often exposes one stub source; use Chromium/portal picker instead. */
const useLinuxSystemDisplayPicker =
  process.platform === 'linux' &&
  process.env.FUZION_CUSTOM_DISPLAY_MEDIA_PICKER !== '1';

const isLinuxWayland =
  process.platform === 'linux' &&
  (process.env.XDG_SESSION_TYPE === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY));

function applyLinuxChromiumFeatureFlags() {
  if (process.platform !== 'linux') {
    return;
  }

  const features = ['PulseaudioLoopbackForScreenShare'];

  // Wayland screen/window capture uses PipeWire via xdg-desktop-portal.
  // Set FUZION_PIPEWIRE_SCREEN_CAPTURE=0 if this breaks microphone / voice WebRTC.
  if (isLinuxWayland && process.env.FUZION_PIPEWIRE_SCREEN_CAPTURE !== '0') {
    features.push('WebRTCPipeWireCapturer');
  }

  app.commandLine.appendSwitch('enable-features', features.join(','));
}

applyLinuxChromiumFeatureFlags();

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
          callback({});
          return;
        }

        const maxItems = 36;
        const screens = sources.filter((src) => src.id.startsWith('screen:'));
        const wins = sources.filter((src) => src.id.startsWith('window:'));
        const ordered = [ ...screens, ...wins ].slice(0, maxItems);

        const pick = (src, includeApplicationAudio = true) => {
          callback(buildDisplayMediaStreams({
            source: src,
            audioRequested: request.audioRequested,
            includeApplicationAudio,
          }));
        };

        if (ordered.length === 1 || useLinuxSystemDisplayPicker) {
          pick(ordered[0]);
          return;
        }

        openDisplayMediaPickerWindow({
          rawSources: ordered,
          request,
          callback,
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
