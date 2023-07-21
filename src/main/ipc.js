const { webContents } = require('electron');

function send(evt, ...args) {
  for (const webContentsInstance of webContents.getAllWebContents()) {
    webContentsInstance.send(evt, ...args);
  }
}

module.exports = {
  send,
};
