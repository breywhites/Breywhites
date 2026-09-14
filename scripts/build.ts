/* Build the site.
   bun scripts/build.ts            → dist/     (production: real paths, config.js to fill in)
   bun scripts/build.ts --preview  → preview/  (demo data, hash routes, relative paths) */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

const preview = process.argv.includes('--preview');
const root = join(import.meta.dir, '..');
const out = join(root, preview ? 'preview' : 'dist');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

// admin styles: a separate file, loaded only when someone opens /admin
const adminCss = await Bun.build({
  entrypoints: [join(root, 'src/styles/admin.css')],
  outdir: join(out, 'assets'),
  naming: { entry: 'admin-[hash].[ext]' },
  minify: true,
});
if (!adminCss.success) {
  for (const log of adminCss.logs) console.error(log);
  process.exit(1);
}
const adminCssFile = adminCss.outputs[0].path.split('/assets/')[1];

const result = await Bun.build({
  entrypoints: [join(root, 'src/main.tsx')],
  outdir: join(out, 'assets'),
  naming: { entry: 'app-[hash].[ext]', asset: '[name]-[hash].[ext]', chunk: 'chunk-[hash].[ext]' },
  minify: true,
  target: 'browser',
  format: 'esm',
  splitting: true,
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.BW_ADMIN_CSS': JSON.stringify((preview ? '' : '/') + 'assets/' + adminCssFile) },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const files = result.outputs.map((o) => o.path.split('/assets/')[1]);
const js = result.outputs.find((o) => o.kind === 'entry-point')!.path.split('/assets/')[1];
// chunks the entry imports up front: preload them so the browser fetches in parallel
const entrySrc = readFileSync(join(out, 'assets', js), 'utf8');
const eager = [...new Set([...entrySrc.matchAll(/from"\.\/(chunk-[a-z0-9]+\.js)"/g)].map((m) => m[1]))];
const cssFiles = files.filter((f) => f.endsWith('.css'));
if (cssFiles.length !== 1) { console.error('expected one site stylesheet, got', cssFiles); process.exit(1); }
const css = cssFiles[0];

cpSync(join(root, 'public'), out, { recursive: true });
if (preview) {
  for (const f of ['_redirects', '_headers', 'robots.txt']) rmSync(join(out, f), { force: true });
}

const p = preview ? '' : '/';
const fonts = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@300;400;500&display=swap';
const head = `
<title>${preview ? 'Breywhites Preview' : 'Breywhites — Wedding Photography & Films'}</title>
<meta name="description" content="Breywhites — wedding photography, films and reels. Where your wedding becomes a timeless film.">
<meta name="theme-color" content="#17130f">
<meta property="og:title" content="Breywhites — Wedding Photography & Films">
<meta property="og:description" content="Where your wedding becomes a timeless film. See our work and check your date.">
<meta property="og:type" content="website">
<meta property="og:image" content="${p}og.jpg">
<link rel="icon" href="${p}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
${cssFiles.map((c) => `<link rel="stylesheet" href="${p}assets/${c}">`).join('\n')}
${eager.map((c) => `<link rel="modulepreload" href="${p}assets/${c}">`).join('\n')}`;

const configScript = preview
  ? `<script>window.BW_CONFIG = { router: 'hash', assetBase: '' };</script>`
  : `<script src="/config.js"></script>`;

if (preview) {
  // artifact pages are wrapped in their own <html>/<head>/<body>
  writeFileSync(join(out, 'index.html'), `${head}\n${configScript}\n<div id="root"></div>\n<script type="module" src="assets/${js}"></script>\n`);
} else {
  writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${head}
${configScript}
</head>
<body>
<div id="root"></div>
<noscript><p style="font-family:sans-serif;padding:24px">Breywhites — please enable JavaScript, or message us on WhatsApp: +91 80891 41816</p></noscript>
<script type="module" src="/assets/${js}"></script>
</body>
</html>
`);
  if (!existsSync(join(out, 'config.js'))) {
    writeFileSync(join(out, 'config.js'), `/* Breywhites settings.
   Paste your two Supabase values between the quotes (in Supabase, press "Connect" at the top of your project):
     supabaseUrl      → the Project URL, like https://abcdefgh.supabase.co
     supabaseAnonKey  → the Publishable key (starts with sb_publishable_)
   While both are empty the site shows sample content and the admin runs in preview mode. */
window.BW_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  router: 'path'
};
`);
  }
}

const jsBytes = readFileSync(join(out, 'assets', js));
console.log(`  admin css ${adminCssFile} ${(adminCss.outputs[0].size / 1024).toFixed(0)} KB`);
console.log(result.outputs.map((o) => `  ${o.kind} ${o.path.split('/assets/')[1]} ${(o.size / 1024).toFixed(0)} KB`).join('\n'));
console.log(`${preview ? 'preview' : 'dist'}: ${js} ${(jsBytes.length / 1024).toFixed(0)} KB (${(gzipSync(jsBytes).length / 1024).toFixed(0)} KB gzip)` +
  (css ? `, ${css} ${(statSync(join(out, 'assets', css)).size / 1024).toFixed(0)} KB` : ''));
