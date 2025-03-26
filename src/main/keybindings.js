// const ioHook = require('iohook');
const { ipcMain } = require('electron');
const { keyCodeToKeyEnum, mouseButtonToKeyEnum } = require('keycode-enums');

const ipc = require('./ipc');
const { openSetKeybindingWindow, closeSetKeybindingWindow } = require('./set-keybinding-window.js');

const {
  FUZION_KEYBINDINGS_SET,
  FUZION_KEYBINDINGS_RESET,
  FUZION_KEYBINDING_SET,
  FUZION_KEYBINDING_REMOVE,
  FUZION_KEYBINDING_GET,
  FUZION_KEYBINDING_GET_CALLBACK,
  FUZION_KEYBINDING_CANCEL_GET,
  FUZION_KEYBINDING_ACTION_UPDATE,
  KEYBINDING_GET_CURRENT,
  KEYBINDING_GET_CURRENT_CALLBACK,
  KEYBINDING_KEYS_ACTIVE,
} = require('./ipc-channels');

const ALLOWED_KEYBINDS = [
  'VOICE_SETTINGS/PUSH_TO_TALK',
];

class Keybindings {
  activeActions = [];
  keysActive = [];
  keybindings = [];

  currentKeybinding = null;
  getKeybindingCallback = null;

  constructor() {
    ipcMain.on(
      FUZION_KEYBINDINGS_SET,
      (_, keybindings) => {
        this.setKeybindings(keybindings);
      },
    );

    ipcMain.on(
      FUZION_KEYBINDING_GET,
      (_, keybinding, currentKeys) => {
        this.currentKeybinding = { keybinding, keys: currentKeys };

        openSetKeybindingWindow();
      },
    );

    ipcMain.on(
      KEYBINDING_GET_CURRENT,
      () => {
        const { currentKeybinding } = this;

        ipc.send(KEYBINDING_GET_CURRENT_CALLBACK, currentKeybinding);
      },
    );

    ipcMain.on(
      FUZION_KEYBINDING_CANCEL_GET,
      () => {
        closeSetKeybindingWindow();
      },
    );

    ipcMain.on(
      FUZION_KEYBINDING_GET_CALLBACK,
      (_, keybinding, keys) => {
        ipc.send(FUZION_KEYBINDING_GET_CALLBACK, keybinding, keys);

        closeSetKeybindingWindow();
      },
    );

    ipcMain.on(
      FUZION_KEYBINDING_SET,
      (_, keybinding) => {
        this.setKeybinding(keybinding);
      },
    );

    ipcMain.on(
      FUZION_KEYBINDING_REMOVE,
      (_, keybinding) => {
        this.removeKeybinding(keybinding);
      },
    );

    ipcMain.on(
      FUZION_KEYBINDINGS_RESET,
      (_) => {
        this.resetKeybindings();
      },
    );
  }

  setIohook(ioHook) {
    ioHook.on('mousedown', (data) => {
      this.handleIohookEvent('mousedown', data);
    });
    
    ioHook.on('mouseup', (data) => {
      this.handleIohookEvent('mouseup', data);
    });
    
    ioHook.on('keydown', (data) => {
      this.handleIohookEvent('keydown', data);
    });
    
    ioHook.on('keyup', (data) => {
      this.handleIohookEvent('keyup', data);
    });
    
    ioHook.on('devicedown', (data) => {
      this.handleIohookEvent('devicedown', data);
    });
    
    ioHook.on('deviceup', (data) => {
      this.handleIohookEvent('deviceup', data);
    });
  }

  setIohookWin32(iohook) {
    iohook.on('message', (iohookEvent) => {
      const { type, data } = iohookEvent;

      this.handleIohookEvent(type, data);
    });
  }

  handleIohookEvent(type, data) {
    // console.log('Keycode:', type, data);

    switch (type) {
      case 'keydown': {
        const { keycode: nativeKeycode } = data;
        const keyEnum = keyCodeToKeyEnum('iohook', nativeKeycode);

        if (keyEnum === undefined) {
          console.log('Unrecognized keycode:', type, data);

          return;
        }

        if (this.keysActive.includes(keyEnum)) {
          return;
        }

        this.keysActive.push(keyEnum);

        ipc.send(
          KEYBINDING_KEYS_ACTIVE,
          { keysActive: [ ...this.keysActive ] },
        );

        this.keybindings.forEach(({ keys, action }) => {
          if (this.keysActive.length < keys.length) {
            return;
          }

          if (
            !this.activeActions.includes(action) &&
            keys.every(keyEnum => this.keysActive.indexOf(keyEnum) >= 0)
          ) {
            this.activeActions.push(action);

            ipc.send(
              FUZION_KEYBINDING_ACTION_UPDATE,
              { action, active: true },
            );
          }
        });
      }
      break;

      case 'keyup': {
        const { keycode: nativeKeycode } = data;
        let keyEnum = keyCodeToKeyEnum('iohook', nativeKeycode);

        if (keyEnum === undefined) {
          console.log('Unrecognized keycode:', type, data);

          return;
        }

        if (!this.keysActive.includes(keyEnum)) {
          return;
        }

        this.keysActive = this.keysActive
          .filter(cKeyEnum => cKeyEnum !== keyEnum);

        ipc.send(
          KEYBINDING_KEYS_ACTIVE,
          { keysActive: [ ...this.keysActive ] },
        );

        this.keybindings.forEach(({ keys, action }) => {
          if (!this.activeActions.includes(action)) {
            return;
          }

          if (
            this.keysActive < keys.length ||
            !keys.every(keyEnum => this.keysActive.indexOf(keyEnum) >= 0)
          ) {
            this.activeActions = this.activeActions
              .filter(cAction => cAction !== action);

            ipc.send(
              FUZION_KEYBINDING_ACTION_UPDATE,
              { action, active: false },
            );
          }
        });
      }
      break;

      case 'mousedown': {
        const { button } = data;
        const keyEnum = mouseButtonToKeyEnum('iohook', button);

        if (keyEnum === undefined) {
          console.log('Unrecognized keycode:', type, data);

          return;
        }

        if (this.keysActive.includes(keyEnum)) {
          return;
        }

        this.keysActive.push(keyEnum);

        ipc.send(
          KEYBINDING_KEYS_ACTIVE,
          { keysActive: [ ...this.keysActive ] },
        );

        this.keybindings.forEach(({ keys, action }) => {
          if (this.keysActive.length < keys.length) {
            return;
          }

          if (
            !this.activeActions.includes(action) &&
            keys.every(keyEnum => this.keysActive.indexOf(keyEnum) >= 0)
          ) {
            this.activeActions.push(action);

            ipc.send(
              FUZION_KEYBINDING_ACTION_UPDATE,
              { action, active: true },
            );
          }
        });
      }
      break;

      case 'mouseup': {
        const { button } = data;
        const keyEnum = mouseButtonToKeyEnum('iohook', button);

        if (keyEnum === undefined) {
          console.log('Unrecognized keycode:', type, data);

          return;
        }

        if (!this.keysActive.includes(keyEnum)) {
          return;
        }

        this.keysActive = this.keysActive.filter(cKeyEnum => cKeyEnum !== keyEnum);

        ipc.send(
          KEYBINDING_KEYS_ACTIVE,
          { keysActive: [...this.keysActive] },
        );

        this.keybindings.forEach(({ keys, action }) => {
          if (!this.activeActions.includes(action)) {
            return;
          }

          if (
            this.keysActive < keys.length ||
            !keys.every(keyEnum => this.keysActive.indexOf(keyEnum) >= 0)
          ) {
            this.activeActions = this.activeActions
              .filter(cAction => cAction !== action);

            ipc.send(
              FUZION_KEYBINDING_ACTION_UPDATE,
              { action, active: false },
            );
          }
        });
      }
      break;

      case 'devicedown': {
        const { button } = data;
        const keyEnum = `DEVICE:${button}`;

        if (keyEnum === undefined) {
          console.log('Unrecognized keycode:', type, data);

          return;
        }

        if (this.keysActive.includes(keyEnum)) {
          return;
        }

        this.keysActive.push(keyEnum);

        ipc.send(
          KEYBINDING_KEYS_ACTIVE,
          { keysActive: [ ...this.keysActive ] },
        );

        this.keybindings.forEach(({ keys, action }) => {
          if (this.keysActive.length < keys.length) {
            return;
          }

          if (
            !this.activeActions.includes(action) &&
            keys.every(keyEnum => this.keysActive.indexOf(keyEnum) >= 0)
          ) {
            this.activeActions.push(action);

            ipc.send(
              FUZION_KEYBINDING_ACTION_UPDATE,
              { action, active: true },
            );
          }
        });
      }
      break;

      case 'deviceup': {
        const { button } = data;
        const keyEnum = `DEVICE:${button}`;

        if (keyEnum === undefined) {
          console.log('Unrecognized keycode:', type, data);

          return;
        }

        if (!this.keysActive.includes(keyEnum)) {
          return;
        }

        this.keysActive = this.keysActive
          .filter(cKeyEnum => cKeyEnum !== keyEnum);

        ipc.send(
          KEYBINDING_KEYS_ACTIVE,
          { keysActive: [ ...this.keysActive ] },
        );

        this.keybindings.forEach(({ keys, action }) => {
          if (!this.activeActions.includes(action)) {
            return;
          }

          if (
            this.keysActive < keys.length ||
            !keys.every(keyEnum => this.keysActive.indexOf(keyEnum) >= 0)
          ) {
            this.activeActions = this.activeActions
              .filter(cAction => cAction !== action);

            ipc.send(
              FUZION_KEYBINDING_ACTION_UPDATE,
              { action, active: false },
            );
          }
        });
      }
      break;
    }
  }

  setKeybindings(keybindings) {
    this.resetActiveKeys();

    [ ...keybindings ]
      .forEach(keybinding => this.setKeybinding(keybinding));
  }

  setKeybinding(keybinding) {
    const { group, key } = keybinding;

    if (!ALLOWED_KEYBINDS.includes(`${group}/${key}`)) {
      return;
    }

    this.keybindings = this.keybindings
      .filter(({ cGroup, cKey }) => cGroup === group && cKey === key);

    this.keybindings.push(keybinding);
  }

  removeKeybinding(keybinding) {
    const { group, key } = keybinding;

    this.keybindings = this.keybindings
      .filter(({ cGroup, cKey }) => {
        return !(
          cGroup === group &&
          cKey === key
        );
      });
  }

  resetKeybindings() {
    this.resetActiveKeys();

    this.keybindings = [];
  }

  resetActiveKeys() {
    this.keysActive = [];

    this.activeActions.forEach((_action) => {
      ipc.send(
        FUZION_KEYBINDING_ACTION_UPDATE,
        {},
      );
    });

    this.activeActions = [];
  }
}

module.exports = {
  Keybindings,
};
