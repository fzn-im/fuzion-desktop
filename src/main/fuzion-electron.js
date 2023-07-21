const { Keybindings } = require('./keybindings');
const MainWindow = require('./main-window');

class FuzionElectron {
  mainWindow = null;

  constructor() {
    this.keybindings = new Keybindings();
    this.mainWindow = new MainWindow();
  }

  setIohook(iohook) {
    this.keybindings.setIohook(iohook);
  }

  setIohookWin32(iohook) {
    this.keybindings.setIohookWin32(iohook);
  }
}

module.exports = FuzionElectron;
