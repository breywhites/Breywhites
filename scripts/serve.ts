/* Local static server with SPA fallback: bun scripts/serve.ts [dir] [port] */
import { existsSync, statSync } from 'fs';
import { join, normalize } from 'path';
const dir = process.argv[2] || 'dist';
const port = Number(process.argv[3] || 4173);
Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    const p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, '');
    let file = join(dir, p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) file = join(dir, 'index.html');
    return new Response(Bun.file(file));
  },
});
console.log(`serving ${dir} on http://localhost:${port}`);
