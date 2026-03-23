const { spawnSync } = require('node:child_process');
const { basename } = require('path');
const process = require('process');

if (!process.env.DEST_SCP_DIST) {
  console.error(
    'DEST_SCP_DIST is not set. Set it to the scp destination base, e.g. user@host:/var/www/dist',
  );
  process.exit(1);
}

[
  'dist/fuzion-installer.zip',
  'dist/fuzion-installer.zip.blockmap',
  'dist/fuzion-installer.dmg',
  'dist/fuzion-installer.dmg.blockmap',
  'dist/latest-mac.yml'
].forEach((file) => {
  const dest = `${process.env.DEST_SCP_DIST}/mac/arm64/`;

  console.log('Uploading to:', `${dest}${basename(file)}`);

  spawnSync('scp', [file, dest]);
});
