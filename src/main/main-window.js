const {
  app,
  globalShortcut,
  BrowserWindow,
  Menu,
  MenuItem,
  Tray,
  webContents,
} = require('electron');
const path = require('path');
const open = require('open');
const parseUrl = require('parse-url');
const windowStateKeeper = require('./electron-window-state');
const process = require('process');
const { handleAutoUpdater } = require('./updater');
const { getBuildPath } = require('../utils/path');
// const { ElectronBlocker } = require('@cliqz/adblocker-electron');
// const { fetch } = require('cross-fetch');

class MainWindow {
  tray = null;
  trayMenu = null;
  window = null;
  quiting = false;
  mainWebContentsId = null;

  currentGuestHost = null;

  formatHostUrl (hostUrl) {
    return `${hostUrl}?_=${Math.random() * 100000}`;
  }

  constructor () {
    // set systray icon based on os
    let trayIcon = "../assets/icon/logo.png";
    switch (process.platform) {
      case "win32":
        trayIcon = "../assets/icon/icon-all.ico";
        break;
      // case "darwin":
      //   trayIcon = "../icon.icns";
    }

    // when systray clicked, show and focus
    this.tray = new Tray(path.join(__dirname, trayIcon));
    this.tray.on("click", () => {
      this.window?.show()
      this.window?.focus();
    });

    let mainWindowState = windowStateKeeper({
      defaultWidth: 1260,
      defaultHeight: 900,
    });

    this.window = new BrowserWindow({
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      show: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#1B1D28',
        symbolColor: '#CEE61B',
        height: 26,
      },
      webPreferences: {
        nodeIntegration: true,
        sandbox: false,
        webSecurity: false,
        preload: path.join(getBuildPath(), './host-preload.js'),
        plugins: true,
        allowRunningInsecureContent: true,
        webviewTag: true,
      },
    });
    mainWindowState.manage(this.window);
    // ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((block) => {
    //   block.enableBlockingInSession(session.defaultSession);
    // });

    this.window.setBackgroundColor('#1B1D28');
    this.window.removeMenu();
    this.window.setMenuBarVisibility(false);
    this.window.webContents.setZoomFactor(1);

    this.mainWebContentsId = this.window.webContents.id;

    this.window.once('ready-to-show', () => {
      if (!this.window) {
        return;
      }

      this.window.show();

      this.window.webContents.on('did-finish-load', () => {
        this.initGuestWebContents();
      });

      this.window.webContents.on('ipc-message', (_, channel) => {
        switch (channel) {
        case 'FUZION_NEW_WEBVIEW':
          this.initGuestWebContents();
          break;
        }
      });

      this.window.webContents.on('did-create-window', (childWindow) => {
        childWindow.removeMenu();
        childWindow.setMenuBarVisibility(false);
      });
    });

    // set systray menu
    this.trayMenu = new Menu();
    this.trayMenu.append(new MenuItem({
      label: "Open Fuzion",
      id: "open",
      click: () => {
        this.window?.show()
        this.window?.focus();
      }
    }));
    this.trayMenu.append(new MenuItem({
      label: "Quit Fuzion",
      id: "quit",
      click: () => {
        this.quit();
      }
    }));
    this.tray.setContextMenu(this.trayMenu);

    // set window icon based on os
    var winIcon = "../assets/icon/icon.png";
    switch (process.platform) {
      case "win32":
        winIcon = "../assets/icon/icon.ico";
        break;
      // case "darwin":
      //   winIcon = "logo_16x16.png";
    }
    this.window.setIcon(path.join(__dirname, winIcon));

    // load url based on environment
    if (process.argv.includes('local')) {
      this.window.loadURL(this.formatHostUrl('http://127.0.0.1:8187/portal/'));
    } else {
      this.window.loadURL(this.formatHostUrl('http://fzn.im/portal/'));
    }

    // override default close to minimize-to-tray
    this.window.on('close', (evt) => {
      if (!this.quiting) {
        evt.preventDefault()

        this.window.hide();
      }

      return false;
    });

    app.on('second-instance', () => {
      if (!this.window) {
        return;
      }

      this.window.show();

      if (this.window.isMinimized()) {
        this.window.focus();
      }

      this.window.focus();
    });

    // add shortcut for accessing development panel
    globalShortcut.register(
      'CommandOrControl+Shift+i',
      () => {
        this.window.webContents.openDevTools();
      },
    );

    handleAutoUpdater();
  }

  initGuestWebContents () {
    this.guestWebContents = webContents
      .getAllWebContents()
      .find(({ id }) => id !== this.mainWebContentsId);
    if (!this.guestWebContents) {
      return;
    }

    this.handleGuestHostChange(this.guestWebContents.getURL());

    this.guestWebContents.on('did-navigate-in-page', (_, url, isMainFrame) => {
      if (isMainFrame) {
        this.handleGuestHostChange(url);
      }
    });

    this.guestWebContents.setWindowOpenHandler((details) => {
      const { url } = details;
      // @ts-ignore
      const { pathname, resource } = parseUrl(url);

      if (
        (resource.endsWith('twitch.tv') && pathname.startsWith('/login')) ||
        (resource.endsWith(this.currentGuestHost) && pathname.startsWith('/embed'))
      ) {
        return { action: 'allow' };
      } else {
        open(url);
        return;
      }
    });
  }

  handleGuestHostChange (url) {
    const { resource } = parseUrl(url);

    this.currentGuestHost = resource;
  }

  setQuiting () {
    this.quiting = true;
  }

  forceClose () {
    this.quiting = true;

    this.window?.close();
    this.window = null;
  }

  quit () {
    if (this.quiting) {
      return;
    }

    // set variable to close process
    this.quiting = true;

    // catch darwin case
    if (process.platform !== "darwin") {
      app.quit();
    } else {
      this.window?.close();
    }

    this.window = null;
  }
}

module.exports = MainWindow;
