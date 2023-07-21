const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

function handleAutoUpdater () {
  log.transports.file.level = 'debug';

  autoUpdater.logger = log;
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(
      null,
      {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Fuzion Update Available',
        message: 'A new version has been downloaded. Restart the application to apply the update?'
      },
    ).then(({ response }) => {
      if (response === 0) {
        global.fuzionElectron?.mainWindow?.setQuiting();

        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 0);
      }
    });
  });

  autoUpdater.checkForUpdatesAndNotify();
}

module.exports = {
  handleAutoUpdater,
};
