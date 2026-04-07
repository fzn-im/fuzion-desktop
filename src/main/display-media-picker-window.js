const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const { getBuildPath } = require('../utils/path');

const {
  FUZION_DISPLAY_MEDIA_PICKER_SOURCES,
  FUZION_DISPLAY_MEDIA_PICKER_SELECT,
  FUZION_DISPLAY_MEDIA_PICKER_CANCEL,
} = require('./ipc-channels');

let currentDisplayMediaPicker = null;

function dispatchCallback(callback, ...args) {
  if (typeof callback !== 'function') {
    return;
  }

  try {
    callback(...args);
  } catch (err) {
    console.error('display-media-picker: callback threw', err);
  }
}

function serializeSources(nativeSources) {
  return nativeSources.map((src) => ({
    id: src.id,
    name: src.name,
    kind: src.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnailDataUrl: src.thumbnail && !src.thumbnail.isEmpty()
      ? src.thumbnail.toDataURL()
      : '',
  }));
}

class DisplayMediaPickerWindow {
  window = null;
  resolved = false;
  rawSources = [];
  request = null;
  callback = null;

  constructor({ rawSources, request, callback }) {
    this.rawSources = rawSources;
    this.request = request;
    this.callback = callback;

    if (currentDisplayMediaPicker !== null) {
      currentDisplayMediaPicker.cancel();
    }
    currentDisplayMediaPicker = this;

    this.window = new BrowserWindow({
      width: 720,
      height: 560,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false,
        preload: path.join(getBuildPath(), './display-media-picker-preload.js'),
      },
    });

    var winIcon = '../assets/icon/icon.png';
    switch (process.platform) {
      case 'win32':
        winIcon = '../assets/icon/icon.ico';
        break;
    }
    this.window.setIcon(path.join(__dirname, winIcon));

    this.window.setBackgroundColor('#1B1D28');
    this.window.removeMenu();
    this.window.setMenuBarVisibility(false);
    this.window.webContents.setZoomFactor(1);
    this.window.setAlwaysOnTop(true, 'screen');

    ipcMain.on(FUZION_DISPLAY_MEDIA_PICKER_SELECT, this.onSelect);
    ipcMain.on(FUZION_DISPLAY_MEDIA_PICKER_CANCEL, this.onCancel);

    this.window.on('close', this.onWindowClose);

    const payload = serializeSources(rawSources);

    // Use loadFile (not file:// + path) so Windows paths resolve correctly in Chromium.
    void this.window.loadFile(path.join(getBuildPath(), 'display-media-picker.html'));
    this.window.setTitle('Share screen');

    this.window.webContents.once('did-finish-load', () => {
      if (this.window.isDestroyed()) {
        return;
      }

      this.window.webContents.send(FUZION_DISPLAY_MEDIA_PICKER_SOURCES, payload);
      this.window.show();
      // this.window.webContents.openDevTools({ mode: 'detach' });
    });
  }

  onWindowClose = () => {
    if (this.resolved) {
      return;
    }

    this.resolved = true;
    this.detachIpc();
    dispatchCallback(this.callback, {});
    currentDisplayMediaPicker = null;
  };

  onSelect = (event, sourceId) => {
    if (this.resolved || !this.window || this.window.isDestroyed()) {
      return;
    }

    if (BrowserWindow.fromWebContents(event.sender) !== this.window) {
      return;
    }

    const src = this.rawSources.find((s) => s.id === sourceId);
    if (!src) {
      this.cancel();
      return;
    }

    this.resolved = true;
    this.detachIpc();

    const streams = {
      video: { id: src.id, name: src.name },
    };

    if (this.request.audioRequested && process.platform === 'win32') {
      streams.audio = 'loopback';
    }

    dispatchCallback(this.callback, streams);
    currentDisplayMediaPicker = null;
    this.window.close();
  };

  onCancel = (event) => {
    if (this.resolved || !this.window || this.window.isDestroyed()) {
      return;
    }
    if (BrowserWindow.fromWebContents(event.sender) !== this.window) {
      return;
    }
    this.cancel();
  };

  cancel() {
    if (this.resolved || !this.window || this.window.isDestroyed()) {
      return;
    }

    this.resolved = true;
    this.detachIpc();
    dispatchCallback(this.callback, {});
    currentDisplayMediaPicker = null;
    this.window.close();
  }

  detachIpc() {
    ipcMain.removeListener(FUZION_DISPLAY_MEDIA_PICKER_SELECT, this.onSelect);
    ipcMain.removeListener(FUZION_DISPLAY_MEDIA_PICKER_CANCEL, this.onCancel);

    if (this.window && !this.window.isDestroyed()) {
      this.window.removeListener('close', this.onWindowClose);
    }
  }
}

function openDisplayMediaPickerWindow({ rawSources, request, callback }) {
  return new DisplayMediaPickerWindow({ rawSources, request, callback });
}

module.exports = {
  DisplayMediaPickerWindow,
  openDisplayMediaPickerWindow,
};
