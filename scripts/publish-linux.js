
const { spawnSync } = require('node:child_process');
const { basename } = require('path');

[
  'dist/fuzion.tar.gz',
].forEach((file) => {
  const dest = `${process.env.DEST_SCP_DIST}/linux/x64/`;

  console.log('Uploading to:', `${dest}${basename(file)}`);

  spawnSync('scp', [file, dest]);
});
