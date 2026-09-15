// Expo Router's web.output "single" mode always uses its own fixed HTML
// template and ignores app/+html.tsx, so the PWA meta tags/manifest link
// have to be patched into the exported dist/index.html after the fact.
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!existsSync(indexPath)) {
  console.error(`inject-web-meta: ${indexPath} not found — run "expo export --platform web" first.`);
  process.exit(1);
}

let html = readFileSync(indexPath, 'utf8');

html = html.replace(
  /<meta name="viewport" content="[^"]*"\s*\/?>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no" />',
);

html = html.replace('<html lang="en">', '<html lang="pt-BR">');

const extraHead = `
  <meta name="theme-color" content="#121212" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Anilha" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/icon.png" />
`;

html = html.replace('</head>', `${extraHead}</head>`);

writeFileSync(indexPath, html);
console.log('inject-web-meta: PWA meta tags/manifest link injected into dist/index.html');
