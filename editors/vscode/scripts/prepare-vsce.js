const { execSync } = require('node:child_process');

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

run('npm install --production --ignore-scripts');
