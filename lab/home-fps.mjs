// Frame rate of the real home page (mock, `npm run serve`) while scrolling through each part, on the GPU.
//   node lab/home-fps.mjs [width=1440] [height=900]
import { chromium } from '@playwright/test';

const [w = '1440', h = '900'] = process.argv.slice(2);
const W = Number(w), H = Number(h), phone = W < 600;
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(3000);
// Scroll smoothly across [from, to] of a section's sticky stretch over 2.5 s, counting frames and the worst gap.
const sweep = (sel, from, to) => page.evaluate(([sel, from, to]) => new Promise((done) => {
  const el = document.querySelector(sel);
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
await sweep('#cbg-band', 0, 0.05); await page.waitForTimeout(2500); // let the 3D load
rows.push(['band 0-1', await sweep('#cbg-band', 0, 1)]);
const n = await page.evaluate(() => document.querySelectorAll('#cbg-courses [data-scene]').length);
await sweep('#cbg-courses', 0, 0.02); await page.waitForTimeout(Number(process.env.WAIT ?? 2000));
for (let i = 0; i < n; i++) rows.push([`story ${i}`, await sweep('#cbg-courses', i / n, (i + 1) / n)]);
rows.push(['about (globe)', await sweep('#cbg-about', 0, 1)]);
for (const [k, v] of rows) console.log(`${W} ${k}: ${v.fps} fps, worst frame ${v.worst} ms`);
await browser.close();
