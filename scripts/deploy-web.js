const { execSync } = require('node:child_process');
const { cpSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

const distDir = path.join(root, 'dist');
const outputDir = path.join(root, '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');

run('npx expo export --platform web');

// Deploy via the Vercel Build Output API (--prebuilt) instead of `vercel deploy dist`.
// Letting Vercel re-build a plain static export through its zero-config detection
// has produced empty/404 deployments for this project — --prebuilt skips that
// entirely and uploads exactly what expo already built.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(distDir, staticDir, { recursive: true });

writeFileSync(
  path.join(outputDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' }],
    },
    null,
    2,
  ),
);

run('npx vercel deploy --prebuilt --prod --yes');
