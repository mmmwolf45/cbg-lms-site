// Gzip budget gate (SPEC section 8), per page: what one page downloads must stay within 60 KB of JS
// and 25 KB of CSS, gzipped at level 9. JS per page = the entry (cbg.<hash>.js, holds GSAP and the
// shared motion layer) + that page's lazy chunk (cbg-<page>.<hash>.js) + any other shared chunk.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = { js: 60 * KB, css: 25 * KB } as const;
const PAGES = ['home', 'course'];

const gz = (f: string) => gzipSync(readFileSync(`dist/${f}`), { level: 9 }).length;
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;
const files = readdirSync('dist');
const size = Object.fromEntries(files.filter((f) => /^cbg[.-].*\.(js|css)$/.test(f)).map((f) => [f, gz(f)]));
for (const [f, n] of Object.entries(size)) console.log(`  ${f}: ${kb(n)} gzipped`);

const js = Object.keys(size).filter((f) => f.endsWith('.js'));
const entry = js.filter((f) => f.startsWith('cbg.'));
const pageChunk = (p: string) => js.filter((f) => f.startsWith(`cbg-${p}.`));
const shared = js.filter((f) => f.startsWith('cbg-') && !PAGES.some((p) => f.startsWith(`cbg-${p}.`)));
const css = Object.keys(size).filter((f) => f.endsWith('.css'));
const sum = (fs: string[]) => fs.reduce((n, f) => n + size[f], 0);

let failed = false;
const check = (label: string, n: number, budget: number) => {
  const ok = n <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok' : 'OVER BUDGET'} ${label}: ${kb(n)} of ${kb(budget)}`);
};
for (const p of PAGES) check(`js (${p} page)`, sum([...entry, ...pageChunk(p), ...shared]), BUDGET.js);
check('css', sum(css), BUDGET.css);
if (failed) process.exit(1);
