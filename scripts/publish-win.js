const { spawnSync } = require('node:child_process');
const { basename } = require('path');

if (!process.env.DEST_SCP_DIST) {
  console.error(
    'DEST_SCP_DIST is not set. Set it to the scp destination base, e.g. user@host:/var/www/dist',
  );
  process.exit(1);
}

[
  'dist/fuzion-installer.exe',
  'dist/fuzion-installer.exe.blockmap',
  'dist/latest.yml'
].forEach((file) => {
  const dest = `${process.env.DEST_SCP_DIST}/win/x64/`;

  console.log('Uploading to:', `${dest}${basename(file)}`);

  spawnSync('scp', [file, dest]);
});
