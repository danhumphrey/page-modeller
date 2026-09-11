// Serves tests/fixtures over http so the extension can run against them —
// content scripts don't get file:// pages without an extra opt-in per browser.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../tests/fixtures/', import.meta.url).pathname;
const PORT = Number(process.env.FIXTURES_PORT ?? 5199);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const requested = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const path = requested === '/' ? 'login.html' : requested;
  try {
    let body = await readFile(join(ROOT, path));
    if (extname(path) === '.html') {
      // frames.html embeds a genuinely cross-origin iframe. 127.0.0.1 and
      // localhost are different origins to the browser while being the same
      // server, so no second process is needed — and substituting here rather
      // than hard-coding keeps it correct when FIXTURES_PORT changes.
      body = body.toString().replaceAll('__CROSS_ORIGIN__', `http://127.0.0.1:${PORT}`);
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => {
  const pages = ['login', 'widgets', 'edgecases', 'ambiguous', 'frames', 'frameset'];
  console.log(`fixtures: http://localhost:${PORT}/`);
  for (const page of pages) console.log(`  http://localhost:${PORT}/${page}.html`);
  console.log('\nframes.html embeds 127.0.0.1 as a cross-origin child — reach it via localhost, not 127.0.0.1,');
  console.log('or the "cross-origin" frame will be same-origin.');
});
