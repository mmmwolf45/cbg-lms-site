// Gzip budget gate (SPEC section 8), per page, gzipped at level 9: JS 68 KB on the home page (raised for the
// night-sky effects, 6 Oct 2026) and 60 KB on course pages; CSS 25 KB. JS per page = the entry (cbg.<hash>.js,
// holds GSAP and the shared motion layer) + that page's lazy chunk (cbg-<page>.<hash>.js) + any other shared
// chunk. Also the home band's film frames, an approved exception to the
// image budget (raw bytes per set).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { OUT as ORBIT, SIZES as ORBIT_SIZES } from './orbit-frames';

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
const shared = js.filter((f) => f.startsWith('cbg-') && !PAGES.some((p) => f.startsWith(`cbg-${p}.`)));
const css = Object.keys(size).filter((f) => f.endsWith('.css'));
const sum = (fs: string[]) => fs.reduce((n, f) => n + size[f], 0);

let failed = false;
const check = (label: string, n: number, budget: number) => {
  const ok = n <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok' : 'OVER BUDGET'} ${label}: ${kb(n)} of ${kb(budget)}`);
};
for (const p of PAGES) check(`js (${p} page)`, sum([...entry, ...pageChunk(p), ...shared]), BUDGET.js[p]);
check('css', sum(css), BUDGET.css);
for (const [d, { budgetKB }] of Object.entries(ORBIT_SIZES)) {
  const dir = `dist/${ORBIT.replace(/^public\//, '')}/${d}`;
  check(`band frames (${d})`, readdirSync(dir).reduce((n, f) => n + statSync(`${dir}/${f}`).size, 0), budgetKB * KB);
}
if (failed) process.exit(1);
