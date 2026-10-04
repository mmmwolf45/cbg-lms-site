// Static server for a built lab folder: npx tsx lab/serve.ts [dir=lab/out] [port=4310]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIR = process.argv[2] ?? 'lab/out';
const PORT = Number(process.argv[3] ?? 4310);
const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const rel = normalize(path).replace(/^([/\\]|\.\.[/\\])+/, '');
  const file = join(DIR, rel === '' || rel === '.' ? 'index.html' : rel);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`lab: http://localhost:${PORT}/ serving ${DIR}`));
