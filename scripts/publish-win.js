const { spawnSync } = require('node:child_process');
const { basename } = require('path');

[
  'dist/fuzion-installer.exe',
  'dist/fuzion-installer.exe.blockmap',
  'dist/latest.yml'
].forEach((file) => {
  const dest = `${process.env.DEST_SCP_DIST}/win/x64/`;

  console.log('Uploading to:', `${dest}${basename(file)}`);

  spawnSync('scp', [file, dest]);
});
