// In-session A/B of frame times (headful system Chrome, real GPU): one page, variants switched on and off in
// turn, several rounds, so the laptop's drifting GPU clock (heat, power) hits every variant alike.
//   node lab/ab-perf.mjs --port 4173 [--dist dist] --at hero [--scroll] --css "<variant css>" [--css "..."] [--rounds 4]
// A variant is extra CSS, or "js:..." run in the page (e.g. js:__exp={filmMs:31}); "" is the page as built. At a section: --scroll wheels 600 px down and back per state,
// otherwise the page rests (only ambient motion: the sky's twinkle, the globe, the support light...).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2), all = (k) => args.flatMap((a, i) => (a === `--${k}` ? [args[i + 1]] : []));
const one = (k, d) => all(k)[0] ?? d;
const PORT = one('port', '4173'), DIST = one('dist', 'dist'), AT = one('at', 'hero'), ROUNDS = Number(one('rounds', '4')), INTO = Number(one('into', '0')); // px past the section's top
const SCROLL = args.includes('--scroll'), VARIANTS = ['', ...all('css')], CPU = Number(one('cpu', '1'));
// --raw: plain installed Chrome (no Playwright flags, a throwaway profile) attached over CDP, as a user runs it.
let browser, page, chrome;
if (args.includes('--raw')) {
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [`--user-data-dir=${mkdtempSync(join(tmpdir(), 'cbg-raw-'))}`, '--remote-debugging-port=9333', '--no-first-run', '--no-default-browser-check', '--window-size=1454,994', '--window-position=0,0', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !browser; i++) { await new Promise((r) => setTimeout(r, 300)); browser = await chromium.connectOverCDP('http://127.0.0.1:9333').catch(() => undefined); }
  page = browser.contexts()[0].pages()[0] ?? await browser.contexts()[0].newPage();
} else {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1454,994', '--window-position=0,0'] });
  page = await browser.newPage({ viewport: null });
}
await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
  const file = join(DIST, new URL(r.request().url()).pathname.replace('/cbg-lms-site/', ''));
  if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
  const type = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css', json: 'application/json' }[file.split('.').pop()];
  return r.fulfill({ body: readFileSync(file), contentType: type ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
});
if (one('init', '')) await page.addInitScript(one('init', ''));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForTimeout(5000);
await page.bringToFront();
await page.mouse.move(720, 450);
// Warm up (shader compiles, first rasters): one pass down the page.
for (let y = 0, max = 1; y < max - 2;) {
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(60);
  [y, max] = await page.evaluate(() => [scrollY, document.documentElement.scrollHeight - innerHeight]);
}
if (CPU > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: CPU });
const top = await page.evaluate((s) => { const el = document.querySelector(`[data-cbg-section="${s}"]`); const p = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el; return p.getBoundingClientRect().top + scrollY; }, AT) + INTO;
await page.evaluate(() => document.head.append(Object.assign(document.createElement('style'), { id: 'ab' })));
const gaps = VARIANTS.map(() => []);
for (let r = 0; r < ROUNDS; r++) for (let v = 0; v < VARIANTS.length; v++) {
  await page.evaluate(([css, y]) => { globalThis.__exp = {}; const js = css.startsWith('js:'); document.getElementById('ab').textContent = js ? '' : css; if (js) (0, eval)(css.slice(3)); scrollTo(0, y); }, [VARIANTS[v], top]);
  await page.waitForTimeout(1200); // settle
  const rec = page.evaluate(() => new Promise((done) => {
    const g = []; let last = 0; const t0 = performance.now();
    const f = (t) => { if (last) g.push(t - last); last = t; t - t0 < 2500 ? requestAnimationFrame(f) : done(g); };
    requestAnimationFrame(f);
  }));
  if (SCROLL) for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, i < 6 ? 100 : -100); await page.waitForTimeout(190); }
  gaps[v].push(...(await rec));
}
console.log('html class:', await page.evaluate(() => document.documentElement.className)); // cbg-slow: the sky judged the device sluggish
await browser.close();
chrome?.kill();
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
for (let v = 0; v < VARIANTS.length; v++) console.log(`${AT}${SCROLL ? ' scroll' : ' rest'} p50 ${q(gaps[v], 0.5)} p95 ${q(gaps[v], 0.95)} n ${gaps[v].length}  ${VARIANTS[v] || '(as built)'}`);
