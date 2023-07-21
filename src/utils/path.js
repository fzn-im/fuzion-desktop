const path = require('path');
const process = require('process');
const { isPackaged } = require('electron-is-packaged');

const getBuildPath = () => {
  const webpackBundle = typeof WEBPACK_BUNDLE !== 'undefined'
    ? WEBPACK_BUNDLE
    : undefined; 

  return webpackBundle
    ? path.join(__dirname, './')
    : (
      isPackaged
        ? process.resourcesPath
        : path.join(__dirname, '../../build/')
    )
};

module.exports = {
  getBuildPath,
};
