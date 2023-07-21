const process = require('process');
const { exec } = require('child_process');

const packageVersion = process.argv[2].substring(1);

console.log(`Package version: ${packageVersion}`);

exec(`npm version "${packageVersion}" --no-git-tag-version`);
