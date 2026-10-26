// Builds each page into one self-contained HTML file (no <html>/<head>/<body> wrapper, all JS
// and CSS inlined) for hosts that only accept a single page, like Claude artifacts.
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

const PAGES = { 'dragon-riders': 'index.html', 'dragon-designs': 'dragons.html' };

mkdirSync('dist-single', { recursive: true });
for (const [name, page] of Object.entries(PAGES)) {
  const outDir = `.single-build/${name}`;
  await build({
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true, assetsInlineLimit: 1e8, rollupOptions: { input: page, output: { inlineDynamicImports: true } } },
  });
  const assets = `${outDir}/assets`;
  const files = readdirSync(assets);
  const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${assets}/${f}`, 'utf8')).join('\n');
  const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${assets}/${f}`, 'utf8')).join('\n');
  if (js.includes('</script')) throw new Error(`${name}: bundle contains </script>, cannot inline safely`);

  let html = readFileSync(`${outDir}/${page}`, 'utf8');
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  const keepHead = head
    .split('\n')
    .filter((l) => !/<meta charset|<meta name="viewport"|<script|rel="stylesheet" crossorigin|rel="modulepreload"/.test(l))
    .join('\n');
  const out = `${keepHead.trim()}\n<style>${css}</style>\n${body.replace(/<script type="module"[^>]*><\/script>/g, '').trim()}\n<script type="module">${js}</script>\n`;
  writeFileSync(`dist-single/${name}.html`, out);
  console.log(`dist-single/${name}.html ${(out.length / 1024).toFixed(0)} KB`);
}
rmSync('.single-build', { recursive: true, force: true });
