const { globalShortcut, BrowserWindow } = require('electron');
const path = require('path');

const { getBuildPath } = require('../utils/path');

const ipc = require('./ipc');
const { FUZION_KEYBINDING_GET_CLOSED } = require('./ipc-channels');

let currentSetKeybindingWindow = null;

const openSetKeybindingWindow = (currentKeys) => {
  if (currentSetKeybindingWindow === null) {
    currentSetKeybindingWindow = new SetKeybindingWindow(currentKeys);
  } else {
    currentSetKeybindingWindow.focus();
  }
};

const closeSetKeybindingWindow = () => {
  if (currentSetKeybindingWindow !== null) {
    currentSetKeybindingWindow.close();
  }
};

class SetKeybindingWindow {
  window = null;

  constructor () {
    const { openDevTools } = this;

    this.window = new BrowserWindow({
      width: 240,
      height: 320,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        sandbox: false,
        webSecurity: false,
        preload: path.join(getBuildPath(), './keybinding-preload.js'),
      },
    });

    var winIcon = "../assets/icon/icon.png";
    switch (process.platform) {
      case "win32":
        winIcon = "../assets/icon/icon.ico";
        break;
    }
    this.window.setIcon(path.join(__dirname, winIcon));

    this.window.setBackgroundColor('#1B1D28');
    this.window.removeMenu();
    this.window.setMenuBarVisibility(false);
    this.window.webContents.setZoomFactor(1);
    this.window.setAlwaysOnTop(true, 'screen');
    this.window.resizable = false;

    this.window.loadURL(`file://${getBuildPath()}/keybinding.html`);
    this.window.setTitle('Set Keybinding');

    this.window.once('close', () => {
      globalShortcut.unregister("CommandOrControl+Shift+k", openDevTools);

      currentSetKeybindingWindow = null;

      ipc.send(FUZION_KEYBINDING_GET_CLOSED);
    });

    this.window.show();

    // add shortcut for accessing development panel
    globalShortcut.register("CommandOrControl+Shift+k", openDevTools);
  }

  openDevTools = () => {
    this.window.webContents.openDevTools();
  };

  focus () {
    this.window.focus();
  }

  close () {
    this.window.close();
  }
}

module.exports = {
  closeSetKeybindingWindow,
  openSetKeybindingWindow,
  SetKeybindingWindow,
};
