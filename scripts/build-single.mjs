// Inlines the Vite build into one HTML file (no <html>/<head>/<body> wrapper),
// for hosts that only accept a single page.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const assets = 'dist/assets';
const files = readdirSync(assets);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${assets}/${f}`, 'utf8')).join('\n');
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${assets}/${f}`, 'utf8')).join('\n');
if (js.includes('</script')) throw new Error('bundle contains </script>, cannot inline safely');

const html = `<title>Voxel Explorer</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&display=swap">
<style>${css}</style>
<div id="app"></div>
<div id="loading" class="overlay loading"><div>Building your world…</div></div>
<script type="module">${js}</script>
`;
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/voxel-explorer.html', html);
console.log(`dist-single/voxel-explorer.html ${(html.length / 1024).toFixed(0)} KB`);
