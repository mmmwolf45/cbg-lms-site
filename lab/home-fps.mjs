// Frame rate of the real home page (mock, `npm run serve`) while scrolling through each part, on the GPU.
//   node lab/home-fps.mjs [width=1440] [height=900]
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [w = '1440', h = '900'] = process.argv.slice(2);
const W = Number(w), H = Number(h), phone = W < 600;
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone });
// The blocks name their assets on the Pages base; until they are deployed, serve them from dist/.
await page.route('https://mmmwolf45.github.io/cbg-lms-site/**', (r) => {
  const file = 'dist/' + new URL(r.request().url()).pathname.replace('/cbg-lms-site/', '');
  if (!existsSync(file)) return r.fulfill({ status: 404, body: '' });
  const type = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', js: 'text/javascript', css: 'text/css' }[file.split('.').pop()];
  return r.fulfill({ body: readFileSync(file), contentType: type ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
});
// Headless Chrome has no display to pace its frames: rAF keeps 60 fps while the GPU falls behind, and the
// queued work surfaces later as one multi-second "freeze" at the first GPU sync (a WebGL context made or
// dropped, a readback). 6 Oct 2026, Intel UHD laptop: 10 s of scrolling the home page left 11 s of GPU work
// queued (22 s with the sky); a real Chrome window drew the same scroll at 13 to 18 fps instead. A 1-pixel
// readback every frame waits for the GPU, so the frame times here are the ones a real window shows.
await page.addInitScript(() => {
  const g = document.createElement('canvas').getContext('webgl'), px = new Uint8Array(4);
  const sync = () => { g?.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); requestAnimationFrame(sync); };
  requestAnimationFrame(sync);
});
await page.goto('http://localhost:4173/');
await page.waitForTimeout(3000);
// Scroll smoothly across [from, to] of a section's sticky stretch over 2.5 s, counting frames and the worst gap.
const sweep = (sel, from, to) => page.evaluate(([sel, from, to]) => new Promise((done) => {
  const el = document.querySelector(sel);
  if (!el) return done({ fps: '-', worst: '-' }); // not on this screen or mode (the pan: laptop fallback only)
  const r = el.getBoundingClientRect();
  const y0 = scrollY + r.top + from * Math.max(0, r.height - innerHeight);
  const y1 = scrollY + r.top + to * Math.max(0, r.height - innerHeight);
  scrollTo(0, y0);
  let n = 0, worst = 0, last = performance.now();
  const t0 = last;
  (function f(now) {
    n++; worst = Math.max(worst, now - last); last = now;
    const k = Math.min(1, (now - t0) / 2500);
    scrollTo(0, y0 + (y1 - y0) * k);
    k < 1 ? requestAnimationFrame(f) : done({ fps: Math.round(n / 2.5), worst: Math.round(worst) });
  })(t0);
}), [sel, from, to]);
const rows = [];
await sweep('.cbg-orbit', 0, 0.02); await page.waitForTimeout(3000); // let the band's frames load
rows.push(['band (orbit) 0-1', await sweep('.cbg-orbit', 0, 1)]);
rows.push(['courses (pan)', await sweep('.pin-spacer:has(#cbg-courses)', 0, 1)]);
await sweep('#cbg-courses.is-story', 0, 0.01); await page.waitForTimeout(3000); // let the first film load
rows.push(['courses (story) chapters 0-2', await sweep('#cbg-courses.is-story', 0, 0.34)]);
rows.push(['courses (story) 0-1', await sweep('#cbg-courses.is-story', 0, 1)]);
rows.push(['about (globe)', await sweep('#cbg-about', 0, 1)]);
for (const [k, v] of rows) console.log(`${W} ${k}: ${v.fps} fps, worst frame ${v.worst} ms`);
await browser.close();
