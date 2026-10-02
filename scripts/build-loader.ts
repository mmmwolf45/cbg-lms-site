// Writes dist/manifest.json (our own, not Vite's) and dist/loader-snippet.html after `vite build`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loaderSnippet } from '../src/loader/snippet';

export const PAGES_BASE = 'https://mmmwolf45.github.io/cbg-lms-site/';

const files = readdirSync('dist');
const pick = (ext: string) => {
  const found = files.filter((f) => f.startsWith('cbg.') && f.endsWith(ext));
  if (found.length !== 1) throw new Error(`expected one dist/cbg.*${ext}, found ${found.length}`);
  return found[0];
};

const manifest = { js: pick('.js'), css: pick('.css'), built: new Date().toISOString() };
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

const critical = readFileSync('src/styles/critical.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const snippet = loaderSnippet(process.env.CBG_BASE ?? PAGES_BASE, critical);
writeFileSync('dist/loader-snippet.html', snippet + '\n');

console.log(`manifest: ${manifest.js}, ${manifest.css}; loader-snippet.html ${Buffer.byteLength(snippet)} bytes`);
