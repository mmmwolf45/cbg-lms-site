// Gzip budget gate (SPEC section 8): dist/cbg.*.js <= 60 KB and dist/cbg.*.css <= 25 KB, gzipped at level 9.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build, type Rollup } from 'vite';

const KB = 1024;
const BUDGET = { js: 60 * KB, css: 25 * KB } as const;

const gz = (buf: Buffer) => gzipSync(buf, { level: 9 }).length;
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;

let failed = false;
for (const ext of ['js', 'css'] as const) {
  const files = readdirSync('dist').filter((f) => f.startsWith('cbg.') && f.endsWith(`.${ext}`));
  const total = files.reduce((sum, f) => {
    const size = gz(readFileSync(`dist/${f}`));
    console.log(`  ${f}: ${kb(size)} gzipped`);
    return sum + size;
  }, 0);
  const ok = total <= BUDGET[ext];
  failed ||= !ok;
  console.log(`${ok ? 'ok' : 'OVER BUDGET'} ${ext}: ${kb(total)} of ${kb(BUDGET[ext])}`);
  if (ext === 'js' && files.length) {
    // Split: rebuild in memory with GSAP left out; the rest of the bundle is GSAP.
    const out = (await build({
      configFile: false,
      logLevel: 'silent',
      build: { write: false, rollupOptions: { input: 'src/main.ts', external: [/^gsap/] } },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    const ours = [out].flat().flatMap((o) => o.output).reduce((n, o) => n + (o.type === 'chunk' ? gz(Buffer.from(o.code)) : 0), 0);
    console.log(`  of which ours about ${kb(ours)}, GSAP core + ScrollTrigger about ${kb(total - ours)}`);
  }
}
if (failed) process.exit(1);
