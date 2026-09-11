const { execSync } = require('node:child_process');
const { copyFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

run('npx expo export --platform web');
copyFileSync(path.join(root, 'vercel.web.json'), path.join(root, 'dist', 'vercel.json'));
run('npx vercel deploy dist --prod');
