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
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => console.log(`fixtures: http://localhost:${PORT}/  (login.html, widgets.html, edgecases.html, ambiguous.html)`));
