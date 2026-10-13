// Gzip budget gate (SPEC section 8), per page, gzipped at level 9: JS 68 KB on the home page (raised for the
// night-sky effects, 6 Oct 2026) and 60 KB on course pages; CSS 25 KB. JS per page = the entry (cbg.<hash>.js,
// holds GSAP and the shared motion layer) + that page's lazy chunk (cbg-<page>.<hash>.js) + any other shared
// chunk. A course page's own extra chunks (COURSE_EXTRAS: cbg-beam, the Structural page's beam, loaded only
// when the page has one) count on top of the course page's JS, against that page's budget.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = { js: { home: 68 * KB, course: 60 * KB, structural: 62 * KB }, css: 25 * KB } as const;
const COURSE_EXTRAS = { structural: ['beam'] } as const;
const PAGES = ['home', 'course'] as const;

const gz = (f: string) => gzipSync(readFileSync(`dist/${f}`), { level: 9 }).length;
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;
const files = readdirSync('dist');
const size = Object.fromEntries(files.filter((f) => /^cbg[.-].*\.(js|css)$/.test(f)).map((f) => [f, gz(f)]));
for (const [f, n] of Object.entries(size)) console.log(`  ${f}: ${kb(n)} gzipped`);

const js = Object.keys(size).filter((f) => f.endsWith('.js'));
const entry = js.filter((f) => f.startsWith('cbg.'));
const pageChunk = (p: string) => js.filter((f) => f.startsWith(`cbg-${p}.`));
const extras = Object.values(COURSE_EXTRAS).flat().map((x) => `cbg-${x}.`);
const shared = js.filter((f) => f.startsWith('cbg-') && ![...PAGES.map((p) => `cbg-${p}.`), ...extras].some((x) => f.startsWith(x)));
const css = Object.keys(size).filter((f) => f.endsWith('.css'));
const sum = (fs: string[]) => fs.reduce((n, f) => n + size[f], 0);

let failed = false;
const check = (label: string, n: number, budget: number) => {
  const ok = n <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok' : 'OVER BUDGET'} ${label}: ${kb(n)} of ${kb(budget)}`);
};
for (const p of PAGES) check(`js (${p} page)`, sum([...entry, ...pageChunk(p), ...shared]), BUDGET.js[p]);
for (const [page, names] of Object.entries(COURSE_EXTRAS)) {
  const own = js.filter((f) => names.some((x) => f.startsWith(`cbg-${x}.`)));
  check(`js (${page} course page)`, sum([...entry, ...pageChunk('course'), ...shared, ...own]), BUDGET.js[page as keyof typeof COURSE_EXTRAS]);
}
check('css', sum(css), BUDGET.css);
if (failed) process.exit(1);
