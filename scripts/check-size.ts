// Gzip budget gate (SPEC section 8), per page, gzipped at level 9: JS 68 KB on the home page (raised for the
// night-sky effects, 6 Oct 2026) and 60 KB on course pages; CSS 25 KB. JS per page = the entry (cbg.<hash>.js,
// holds GSAP and the shared motion layer) + that page's lazy chunk (cbg-<page>.<hash>.js) + any other shared
// chunk. The hero option chunks (cbg-hero-*.js, src/motion/hero-options.ts) load only on a course page
// whose hero uses one, and a page has one hero: a course page counts the largest, the home page none.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = { js: { home: 68 * KB, course: 60 * KB }, css: 25 * KB } as const;
const PAGES = ['home', 'course'] as const;

const gz = (f: string) => gzipSync(readFileSync(`dist/${f}`), { level: 9 }).length;
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;
const files = readdirSync('dist');
const size = Object.fromEntries(files.filter((f) => /^cbg[.-].*\.(js|css)$/.test(f)).map((f) => [f, gz(f)]));
for (const [f, n] of Object.entries(size)) console.log(`  ${f}: ${kb(n)} gzipped`);

const js = Object.keys(size).filter((f) => f.endsWith('.js'));
const entry = js.filter((f) => f.startsWith('cbg.'));
const pageChunk = (p: string) => js.filter((f) => f.startsWith(`cbg-${p}.`));
const heroes = js.filter((f) => f.startsWith('cbg-hero-'));
const shared = js.filter((f) => f.startsWith('cbg-') && !heroes.includes(f) && !PAGES.some((p) => f.startsWith(`cbg-${p}.`)));
const hero = (p: string) => (p === 'course' && heroes.length ? [heroes.reduce((a, b) => (size[b] > size[a] ? b : a))] : []);
const css = Object.keys(size).filter((f) => f.endsWith('.css'));
const sum = (fs: string[]) => fs.reduce((n, f) => n + size[f], 0);

let failed = false;
const check = (label: string, n: number, budget: number) => {
  const ok = n <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok' : 'OVER BUDGET'} ${label}: ${kb(n)} of ${kb(budget)}`);
};
for (const p of PAGES) check(`js (${p} page)`, sum([...entry, ...pageChunk(p), ...shared, ...hero(p)]), BUDGET.js[p]);
check('css', sum(css), BUDGET.css);
if (failed) process.exit(1);
