// Frame times of the real home page (mock, `npm run serve`) while scrolling through each part, on the GPU.
//   node lab/home-fps.mjs [width=1440] [height=900] [cpu-throttle=1]
//   PORT=4175 picks the mock's port (default 4173). A throttle of 4 slows the CPU 4x (CDP), like a cheap laptop.
//   NOSKY=1 runs it without the night sky (as e2e/no-sky.ts), to see what the sky costs.
// Per section: frames per second, the p50 / p95 / worst frame time (ms) and the long tasks (main-thread tasks
// over 50 ms: count and total ms) over a 2.5 s sweep.
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [w = '1440', h = '900', t = '1'] = process.argv.slice(2);
const W = Number(w), H = Number(h), THROTTLE = Number(t), phone = W < 600;
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone });
// The blocks name their assets on the Pages base; until they are deployed, serve them from dist/.
await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
  const file = 'dist/' + new URL(r.request().url()).pathname.replace('/cbg-lms-site/', '');
  if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
  const type = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css' }[file.split('.').pop()];
  return r.fulfill({ body: readFileSync(file), contentType: type ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
});
if (process.env.NOSKY) await page.addInitScript(() => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return this.classList.contains('cbg-sky') ? null : get.call(this, type, ...rest); };
});
await page.goto(`http://localhost:${process.env.PORT ?? 4173}/`);
await page.waitForTimeout(3000);
if (THROTTLE > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

// Over 2.5 s: scroll through el (pass: from entering to leaving the screen; pinned: its sticky stretch; still:
// centred, no scroll) and, if pointer, sweep a mouse pointer
// across el from left to right at 70% height (synthetic pointermove: the desk listens on the band).
const run = (sel, range, pointer = false) => page.evaluate(([sel, range, pointer]) => new Promise((done) => {
  const el = document.querySelector(sel);
  if (!el) return done(null);
  const r = el.getBoundingClientRect(), top = scrollY + r.top;
  const [y0, y1] = range === 'pinned' ? [top, top + r.height - innerHeight]
    : range === 'still' ? [top + r.height / 2 - innerHeight / 2, top + r.height / 2 - innerHeight / 2]
    : [top - innerHeight, top + r.height];
  scrollTo(0, y0);
  const gaps = [], long = [];
  const po = new PerformanceObserver((l) => long.push(...l.getEntries().map((e) => e.duration)));
  po.observe({ type: 'longtask' });
  let last = 0, t0 = 0;
  (function f(now) {
    if (t0) gaps.push(now - last); else t0 = now;
    last = now;
    const k = Math.min(1, (now - t0) / 2500);
    scrollTo(0, y0 + (y1 - y0) * k);
    if (pointer) {
      const b = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: b.left + b.width * (0.05 + 0.9 * k), clientY: b.top + b.height * 0.7 }));
    }
    if (k < 1) return requestAnimationFrame(f);
    po.disconnect();
    gaps.sort((a, b) => a - b);
    const q = (p) => Math.round(gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))]);
    done({ fps: Math.round(gaps.length / 2.5), p50: q(0.5), p95: q(0.95), worst: Math.round(gaps.at(-1)), long: long.length, longMs: Math.round(long.reduce((a, b) => a + b, 0)) });
  })(performance.now());
}), [sel, range, pointer]);

const rows = [
  ['hero', await run('#cbg-hero, [data-cbg-section="hero"]', 'pass')],
  ['strip', await run('[data-cbg-section="disciplines"]', 'pass')],
  ['band (desk) scroll', await run('#cbg-band', 'pass')],
  ['band (desk) pointer', phone ? null : await run('#cbg-band [data-cbg-desk]', 'still', true)],
  ['courses (pan)', await run('.pin-spacer:has(#cbg-courses)', 'pinned')],
  ['courses (row)', await run('#cbg-courses', 'pass')],
  ['support', await run('#cbg-support', 'pass')],
  ['about (globe)', await run('#cbg-about', 'pass')],
];
for (const [k, v] of rows) if (v) console.log(`${W}x${H} cpu/${THROTTLE} ${k}: ${v.fps} fps, p50 ${v.p50} ms, p95 ${v.p95} ms, worst ${v.worst} ms, long tasks ${v.long} (${v.longMs} ms)`);
await browser.close();
