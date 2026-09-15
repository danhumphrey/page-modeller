// Serves tests/fixtures over http so the extension can run against them —
// content scripts don't get file:// pages without an extra opt-in per browser.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, normalize } from 'node:path';

const ROOT = new URL('../tests/fixtures/', import.meta.url).pathname;
const PORT = Number(process.env.FIXTURES_PORT ?? 5199);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/**
 * The fixtures worth listing: every page except the ones another fixture
 * embeds as a frame, which are reachable but are not destinations.
 *
 * Derived rather than written down. The hardcoded list is what left
 * `shadow.html` unlisted for the whole of its existence — and an unlisted
 * fixture is one nobody opens, which for a fixture is the same as not having
 * it. `src` is the frame attribute; `href` is a nav link, so only the first
 * counts as embedding.
 */
function menuPages() {
  const files = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const embedded = new Set();
  for (const file of files) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    for (const [, src] of html.matchAll(/<(?:iframe|frame)\b[^>]*\ssrc="([^"]+)"/gi)) {
      embedded.add(basename(src.split('?')[0]));
    }
  }
  const menu = files.filter((f) => !embedded.has(f)).sort();
  // login.html is what `/` serves, so it leads.
  return [...menu.filter((f) => f === 'login.html'), ...menu.filter((f) => f !== 'login.html')];
}

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
  console.log(`fixtures: http://localhost:${PORT}/`);
  for (const page of menuPages()) console.log(`  http://localhost:${PORT}/${page}`);
  console.log('\nframes.html embeds 127.0.0.1 as a cross-origin child — reach it via localhost, not 127.0.0.1,');
  console.log('or the "cross-origin" frame will be same-origin.');
});
