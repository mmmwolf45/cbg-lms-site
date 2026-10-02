// Local mock of course.link: the preview pages at their real paths, our build at the Pages base.
// Run after `npm run build`: npm run serve, then open http://localhost:4173/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 4173);
const BASE = '/cbg-lms-site/';
const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function fileFor(path: string): string | undefined {
  if (path === '/') return 'dist/preview/home.html';
  if (/^\/course\/(101-[^/]+|preview-101)\/?$/.test(path)) return 'dist/preview/course.html';
  if (path.startsWith(BASE)) return join('dist', normalize(path.slice(BASE.length)).replace(/^(\.\.[/\\])+/, ''));
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const file = fileFor(path);
  try {
    if (!file) throw new Error('not found');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`mock course.link on http://localhost:${PORT}/ and /course/preview-101`));
