const { app, systemPreferences, Menu, BrowserWindow, clipboard, shell } = require('electron');
const { fork } = require('child_process');

const FuzionElectron = require('./fuzion-electron');

const instanceLock = app.requestSingleInstanceLock();

if (!instanceLock) {
  app.quit();
  process.exit(0);
}

let iohook;
let iohookRestart = true;

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

function attachContextMenu(contents) {
  contents.on('context-menu', (event, params) => {
    const {
      isEditable,
      editFlags,
      selectionText,
      linkURL,
      linkText,
      mediaType,
      srcURL,
      hasImageContents,
      x,
      y,
    } = params;

    if (isEditable) {
      event.preventDefault();

      const template = [
        { role: 'undo', enabled: editFlags.canUndo },
        { role: 'redo', enabled: editFlags.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: editFlags.canCut },
        { role: 'copy', enabled: editFlags.canCopy },
        { role: 'paste', enabled: editFlags.canPaste },
        { role: 'pasteAndMatchStyle', enabled: editFlags.canPaste },
        { role: 'delete', enabled: editFlags.canDelete },
        { type: 'separator' },
        { role: 'selectAll', enabled: editFlags.canSelectAll },
      ];

      const menu = Menu.buildFromTemplate(template);
      const win = BrowserWindow.fromWebContents(contents);
      menu.popup({ window: win ?? undefined });
      return;
    }

    if (mediaType === 'image' && srcURL && srcURL.length > 0) {
      event.preventDefault();

      const template = [];

      if (hasImageContents) {
        template.push({
          label: 'Copy Image',
          click: () => {
            contents.copyImageAt(x, y);
          },
        });
      }

      template.push({
        label: 'Copy Image Address',
        click: () => {
          clipboard.writeText(srcURL);
        },
      });

      if (isHttpUrl(srcURL)) {
        template.push({
          label: 'Open Image',
          click: () => {
            void shell.openExternal(srcURL);
          },
        });
      }

      if (linkURL && linkURL.length > 0) {
        template.push({ type: 'separator' });
        template.push({
          label: 'Open Link',
          click: () => {
            void shell.openExternal(linkURL);
          },
        });
        template.push({
          label: 'Copy Link Address',
          click: () => {
            clipboard.writeText(linkURL);
          },
        });

        if (linkText != null && linkText.length > 0) {
          template.push({
            label: 'Copy Link Text',
            click: () => {
              clipboard.writeText(linkText);
            },
          });
        }
      }

      const menu = Menu.buildFromTemplate(template);
      const win = BrowserWindow.fromWebContents(contents);
      menu.popup({ window: win ?? undefined });
      return;
    }

    if (linkURL && linkURL.length > 0) {
      event.preventDefault();

      const template = [
        {
          label: 'Open Link',
          click: () => {
            void shell.openExternal(linkURL);
          },
        },
        { type: 'separator' },
        {
          label: 'Copy Link Address',
          click: () => {
            clipboard.writeText(linkURL);
          },
        },
      ];

      if (linkText != null && linkText.length > 0) {
        template.push({
          label: 'Copy Link Text',
          click: () => {
            clipboard.writeText(linkText);
          },
        });
      }

      const menu = Menu.buildFromTemplate(template);
      const win = BrowserWindow.fromWebContents(contents);
      menu.popup({ window: win ?? undefined });
      return;
    }

    const hasSelection = selectionText != null && selectionText.length > 0;
    if (hasSelection && editFlags.canCopy) {
      event.preventDefault();

      const template = [
        { role: 'copy', enabled: editFlags.canCopy },
        { type: 'separator' },
        { role: 'selectAll', enabled: editFlags.canSelectAll },
      ];

      const menu = Menu.buildFromTemplate(template);
      const win = BrowserWindow.fromWebContents(contents);
      menu.popup({ window: win ?? undefined });
    }
  });
}

app.on('ready', () => {
  app.on('web-contents-created', (_event, contents) => {
    attachContextMenu(contents);
  });

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
